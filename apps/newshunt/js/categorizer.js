// ============================================
// NewsHunt - Article Categorizer
// ============================================

const Categorizer = {
    BATCH_SIZE: 8,
    MAX_BATCH_RETRIES: 2,
    MIN_SPLIT_BATCH_SIZE: 2,

    // Build the categorization prompt
    async _buildPrompt(articles) {
        const interests = (await db.getSetting('interests')) || [];
        const avoidTopics = (await db.getSetting('avoid_topics')) || [];
        const customInstructions = (await db.getSetting('custom_instructions')) || '';

        const interestsText = interests.length
            ? `\n**User interests**: ${interests.join(', ')}`
            : '';
        const avoidText = avoidTopics.length
            ? `\n**Topics to avoid**: ${avoidTopics.join(', ')}`
            : '';
        const customText = customInstructions
            ? `\n**Additional context from user**: "${customInstructions}"`
            : '';

        const articleList = articles.map((article, index) => {
            return `[${index}] Title: "${article.title}"
Source: ${article.feedTitle || 'Unknown'}
Description: ${Utils.truncate(article.description, 160)}
Categories: ${article.categories?.join(', ') || 'N/A'}`;
        }).join('\n\n');

        return `You are an intelligent news curator. Rate each article based on how valuable it is to the reader.

## Rating guide

**5-star - Must Read**
- Major world events, policy changes, elections, geopolitical shifts
- Important technology, AI, or science developments
- Financial or career-impacting news
- Health, safety, or regulatory changes
- Breakthrough discoveries

**4-star - High Value**
- Important analysis or educational stories
- Industry news relevant to growth
- Useful opportunities, tools, products, or services

**3-star - Interesting**
- Worth reading, but not urgent
- General interest, culture, lifestyle, interviews

**2-star - Low Value**
- Minor or niche updates
- Routine coverage with limited new insight

**1-star - Skip**
- Clickbait, sensationalism, rage-bait
- Crime blotters or isolated incidents without broader importance
- Celebrity gossip or trivial drama
- Redundant coverage of the same story

## Important rules
- Articles matching user interests get a boost of +1 star
- Articles matching avoid topics get 1 star automatically
- Focus on articles that make the reader smarter, richer, or more aware
- A random accident or crime is not important unless it reveals a systemic issue
${interestsText}${avoidText}${customText}

## Articles to rate
${articleList}

Respond ONLY with valid JSON in this exact shape:
{
  "ratings": [
    {
      "index": 0,
      "stars": 4,
      "reason": "Brief one-sentence explanation"
    }
  ]
}

Rules:
- Return exactly one rating for every article index
- "stars" must be an integer from 1 to 5
- Keep each "reason" under 18 words
- Do not include markdown or any text outside the JSON object`;
    },

    _stripMarkdownJson(text) {
        let cleaned = String(text || '').trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
        }
        return cleaned.replace(/[\u0000-\u0019]+/g, '');
    },

    _extractBalancedJson(text, openChar, closeChar) {
        let start = -1;
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\' && inString) {
                escaped = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === openChar) {
                if (depth === 0) start = i;
                depth++;
            } else if (ch === closeChar) {
                depth--;
                if (depth === 0 && start !== -1) {
                    return text.slice(start, i + 1);
                }
            }
        }

        return start !== -1 ? text.slice(start) : '';
    },

    _parseRatingsResponse(responseText) {
        const cleaned = this._stripMarkdownJson(responseText);
        const candidates = [
            cleaned,
            this._extractBalancedJson(cleaned, '{', '}'),
            this._extractBalancedJson(cleaned, '[', ']')
        ].filter(Boolean);

        let lastError = null;

        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                const ratings = Array.isArray(parsed) ? parsed : parsed?.ratings;
                if (!Array.isArray(ratings)) {
                    throw new Error('Response JSON did not contain a ratings array');
                }

                return ratings
                    .map(rating => ({
                        index: Number(rating?.index),
                        stars: Number(rating?.stars),
                        reason: String(rating?.reason || '').trim()
                    }))
                    .filter(rating =>
                        Number.isInteger(rating.index)
                        && rating.index >= 0
                        && Number.isInteger(rating.stars)
                        && rating.stars >= 1
                        && rating.stars <= 5
                    );
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Unable to parse ratings JSON');
    },

    async _requestBatchRatings(articles) {
        const prompt = await this._buildPrompt(articles);
        const response = await AI.call([
            { role: 'system', content: 'You are a precise news rating assistant. Return only valid JSON matching the requested schema.' },
            { role: 'user', content: prompt }
        ], {
            temperature: 0.1,
            max_tokens: 3000,
            response_format: { type: 'json_object' },
            task: 'categorize'
        });

        return this._parseRatingsResponse(response);
    },

    async _applyRatings(articles, ratings) {
        const applied = [];
        const seenIndices = new Set();

        for (const rating of ratings) {
            if (seenIndices.has(rating.index)) continue;

            const article = articles[rating.index];
            if (!article) continue;

            await db.updateArticleStars(article.guid, rating.stars, rating.reason);
            seenIndices.add(rating.index);
            applied.push(rating);
        }

        return applied;
    },

    async _splitAndCategorize(articles) {
        if (articles.length <= this.MIN_SPLIT_BATCH_SIZE) {
            const results = [];
            for (const article of articles) {
                results.push(...await this.categorizeBatch([article], 0));
            }
            return results;
        }

        const midpoint = Math.ceil(articles.length / 2);
        const firstHalf = await this.categorizeBatch(articles.slice(0, midpoint), 0);
        const secondHalf = await this.categorizeBatch(articles.slice(midpoint), 0);
        return [...firstHalf, ...secondHalf];
    },

    // Categorize a batch of articles
    async categorizeBatch(articles, attempt = 0) {
        if (!Array.isArray(articles) || articles.length === 0) return [];

        try {
            const ratings = await this._requestBatchRatings(articles);
            const appliedRatings = await this._applyRatings(articles, ratings);

            if (appliedRatings.length !== articles.length) {
                const appliedIndexes = new Set(appliedRatings.map(rating => rating.index));
                const missingArticles = articles.filter((_, index) => !appliedIndexes.has(index));
                const recoveredRatings = missingArticles.length > 0
                    ? await this._splitAndCategorize(missingArticles)
                    : [];

                await db.syncToServer();
                return [...appliedRatings, ...recoveredRatings];
            }

            await db.syncToServer();
            return appliedRatings;
        } catch (error) {
            if (attempt < this.MAX_BATCH_RETRIES) {
                console.warn(`Categorization retry ${attempt + 1}/${this.MAX_BATCH_RETRIES} for batch of ${articles.length}:`, error.message);
                await Utils.sleep(700 * (attempt + 1));
                return this.categorizeBatch(articles, attempt + 1);
            }

            if (articles.length > 1) {
                console.warn(`Splitting categorization batch of ${articles.length} after repeated parse failures`);
                return this._splitAndCategorize(articles);
            }

            console.error('Categorization error:', error);
            return [];
        }
    },

    // Categorize all uncategorized articles in batches
    async categorizeAll(onProgress) {
        const uncategorized = await db.getUncategorizedArticles();
        if (uncategorized.length === 0) return { total: 0, categorized: 0 };

        let categorized = 0;
        const total = uncategorized.length;
        const batches = [];

        for (let i = 0; i < uncategorized.length; i += this.BATCH_SIZE) {
            batches.push(uncategorized.slice(i, i + this.BATCH_SIZE));
        }

        for (let i = 0; i < batches.length; i++) {
            try {
                const batchRatings = await this.categorizeBatch(batches[i]);
                categorized += batchRatings.length;
                if (onProgress) onProgress({ categorized, total, batch: i + 1, totalBatches: batches.length });
            } catch (error) {
                console.error(`Batch ${i + 1} failed:`, error);
                if (onProgress) onProgress({ categorized, total, batch: i + 1, totalBatches: batches.length, error: error.message });
            }

            if (i < batches.length - 1) await Utils.sleep(1000);
        }

        return { total, categorized };
    },

    async reRankAll(onProgress) {
        await db.resetAllRatings();
        return this.categorizeAll(onProgress);
    },

    // ============================================
    // SECOND PASS: Group similar stories + assign topics
    // ============================================
    GROUP_BATCH_SIZE: 30,

    async _buildGroupPrompt(articles) {
        const articleList = articles.map((article, index) => {
            return `[${index}] "${article.title}" (${article.feedTitle || 'Unknown'}, ${article.stars || '?'} stars)`;
        }).join('\n');

        return `You are a news editor organizing a newsroom. Given these articles, do two things:

1. **Group exact duplicate stories** - articles covering the exact same specific news event should be grouped. Pick the best article as the "primary".
2. **Assign 1-3 highly specific event tags** to each article.
   - Do not use broad categories like "Global Politics", "India", "Technology", or "Sports".
   - Do use specific, ongoing subjects like "Russia-Ukraine War", "Tamil Nadu Pension Scheme", "ISRO PSLV Launch", "OpenAI Leadership Change", "Qatar Oil Prices", "German Chancellor Visit".
   - Use the exact same tag name for the same specific event across articles.

## Articles
${articleList}

Respond with ONLY valid JSON:
{
  "groups": [
    {
      "primaryIndex": 0,
      "relatedIndices": [3, 7],
      "groupLabel": "Short description of the specific event"
    }
  ],
  "topics": [
    { "index": 0, "tags": ["Tamil Nadu Pension Scheme", "State Politics"] },
    { "index": 1, "tags": ["ISRO Space Mission"] }
  ]
}

Rules:
- Articles not covering the exact same event as anything else should not appear in groups
- Every article must appear in topics
- Focus on specific events, people, or discoveries, not generic bins
- Tags should be 2-4 words, title-cased`;
    },

    async groupAndTag(onProgress) {
        const articles = await db.getAllArticles();
        const untagged = articles.filter(article => !article.topics || article.topics.length === 0);
        if (untagged.length === 0) return { grouped: 0, tagged: 0 };

        let totalGrouped = 0;
        let totalTagged = 0;
        const batches = [];

        for (let i = 0; i < untagged.length; i += this.GROUP_BATCH_SIZE) {
            batches.push(untagged.slice(i, i + this.GROUP_BATCH_SIZE));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            try {
                const prompt = await this._buildGroupPrompt(batch);
                const response = await AI.call([
                    { role: 'system', content: 'You are a precise news grouping assistant. Always respond with valid JSON only. No markdown or extra text.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.1, max_tokens: 4096, task: 'group' });

                let jsonStr = response.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                }

                const result = JSON.parse(jsonStr);

                if (result.groups) {
                    for (const group of result.groups) {
                        const primary = batch[group.primaryIndex];
                        if (!primary) continue;

                        const groupId = primary.guid;

                        await db.updateArticleGroup(primary.guid, groupId, true, group.groupLabel, group.relatedIndices?.length || 0);

                        for (const relIdx of (group.relatedIndices || [])) {
                            const related = batch[relIdx];
                            if (related && related.guid !== primary.guid) {
                                await db.updateArticleGroup(related.guid, groupId, false, group.groupLabel, 0);
                                totalGrouped++;
                            }
                        }
                    }
                }

                if (result.topics) {
                    for (const topic of result.topics) {
                        const article = batch[topic.index];
                        if (article && topic.tags && topic.tags.length > 0) {
                            await db.updateArticleTopics(article.guid, topic.tags);
                            totalTagged++;
                        }
                    }
                }

                if (onProgress) {
                    onProgress({ batch: batchIndex + 1, totalBatches: batches.length, grouped: totalGrouped, tagged: totalTagged });
                }
            } catch (error) {
                console.error(`Group batch ${batchIndex + 1} failed:`, error);
                if (onProgress) onProgress({ batch: batchIndex + 1, totalBatches: batches.length, error: error.message });
            }

            if (batchIndex < batches.length - 1) await Utils.sleep(1000);
        }

        await db.syncToServer();
        return { grouped: totalGrouped, tagged: totalTagged };
    },

    // ============================================
    // THIRD PASS: Group/Merge similar topics
    // ============================================
    async _buildTopicGroupingPrompt(topics) {
        const topicList = topics.map((topic, index) => `[${index}] "${topic.name}" (${topic.count} articles)`).join('\n');

        return `You are a database organizer. Below is a list of news topics automatically generated by another AI.
Sometimes it creates duplicate or highly similar tags for the exact same entity or event.

Your task is to identify redundant topics and output a plan to merge them.
Merge only if they refer to the exact same thing, such as "Artificial Intelligence" and "AI", or "US Elections" and "United States Elections".
Do not merge different but related things, such as "Apple" and "Microsoft".

## Topics list
${topicList}

Respond with ONLY a valid JSON array of merges. If no merges are needed, return an empty array [].
Format:
[
  {
    "primary": "The standardized best name to keep",
    "aliases": ["Alias 1 to merge into primary", "Alias 2 to merge into primary"]
  }
]

Important:
- Every string in "aliases" must exactly match a topic name from the list
- The "primary" name should also be an existing topic name
- Do not add conversational text or markdown`;
    },

    async groupSimilarTopics() {
        const topics = await db.getAllTopics();
        if (topics.length < 2) return null;

        try {
            const prompt = await this._buildTopicGroupingPrompt(topics);
            const response = await AI.call([
                { role: 'system', content: 'You are a precise data deduplication assistant. Output only a valid JSON array.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.0, max_tokens: 2000, task: 'group' });

            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }

            const merges = JSON.parse(jsonStr);
            if (!Array.isArray(merges) || merges.length === 0) {
                return { merged: 0, totalProcessed: topics.length };
            }

            const articles = await db.getAllArticles();
            let numMerged = 0;

            for (const merge of merges) {
                if (!merge.primary || !Array.isArray(merge.aliases) || merge.aliases.length === 0) continue;

                const primary = merge.primary;
                for (const article of articles) {
                    if (!article.topics || article.topics.length === 0) continue;

                    let changed = false;
                    const newTopics = new Set(article.topics);

                    for (const alias of merge.aliases) {
                        if (alias === primary) continue;
                        if (newTopics.has(alias)) {
                            newTopics.delete(alias);
                            newTopics.add(primary);
                            changed = true;
                            numMerged++;
                        }
                    }

                    if (changed) {
                        await db.updateArticleTopics(article.guid, Array.from(newTopics));
                    }
                }
            }

            if (numMerged > 0) {
                await db.syncToServer();
            }

            return { merged: merges.length, totalProcessed: topics.length, articleUpdates: numMerged };
        } catch (error) {
            console.error('Topic grouping error:', error);
            return null;
        }
    }
};
