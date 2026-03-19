// ============================================
// NewsHunt — Article Categorizer (AI Star Rating)
// Improved with value-focused categorization
// ============================================

const Categorizer = {
    BATCH_SIZE: 15,

    // Build the categorization prompt
    async _buildPrompt(articles) {
        const interests = (await db.getSetting('interests')) || [];
        const avoidTopics = (await db.getSetting('avoid_topics')) || [];
        const customInstructions = (await db.getSetting('custom_instructions')) || '';

        const interestsText = interests.length
            ? `\n**User's interests**: ${interests.join(', ')}`
            : '';
        const avoidText = avoidTopics.length
            ? `\n**Topics the user wants to AVOID**: ${avoidTopics.join(', ')}`
            : '';
        const customText = customInstructions
            ? `\n**Additional context from user**: "${customInstructions}"`
            : '';

        const articleList = articles.map((a, i) => {
            return `[${i}] Title: "${a.title}"\nSource: ${a.feedTitle || 'Unknown'}\nDescription: ${Utils.truncate(a.description, 250)}\nCategories: ${a.categories?.join(', ') || 'N/A'}`;
        }).join('\n\n');

        return `You are an intelligent news curator. Your goal is to rate articles based on the VALUE they provide to the reader. Think like a thoughtful advisor who wants to keep the reader informed about things that actually matter.

## RATING CRITERIA (1-5 stars):

**5★ — Must Read**: Articles that provide **actionable value** or critical awareness:
- Major world events, policy changes, elections, geopolitical shifts that affect people
- New developments in technology, AI, science breakthroughs
- Financial insights, market-moving news, investment opportunities
- Career & job market insights, industry shifts
- Health, safety or regulatory changes that affect daily life
- Breakthrough innovations or discoveries

**4★ — High Value**: Important and informative:
- In-depth analysis of trends the reader should understand
- Educational content that teaches something useful
- Industry news relevant to professional growth
- Travel opportunities, time-sensitive events
- New tools, products, or services that solve real problems

**3★ — Interesting**: Worth reading but not urgent:
- General interest stories with good insight
- Cultural developments, arts, lifestyle ideas
- Interviews with notable figures sharing valuable perspectives

**2★ — Low Value**: Minor or niche:
- Very niche topics unlikely to affect the reader
- Routine updates without new insights
- Repetitive coverage of already-known events

**1★ — Skip**: No value or noise:
- Clickbait, sensationalism, rage-bait
- Crime blotters ("man killed wife", specific accidents)
- Celebrity gossip, tabloid content
- Trivial social media drama
- Redundant coverage (same story from many sources)

## IMPORTANT RULES:
- Articles matching user interests get a BOOST of +1 star
- Articles matching avoid topics get 1★ automatically
- Focus on articles that make the reader SMARTER, RICHER, or MORE AWARE
- A random accident or crime is NOT important unless it reveals a systemic issue
${interestsText}${avoidText}${customText}

## ARTICLES TO RATE:
${articleList}

Respond ONLY with a valid JSON array. Each element:
- "index": article index [0, 1, 2, ...]
- "stars": integer 1-5
- "reason": brief 1-sentence explanation of the rating`;
    },

    // Categorize a batch of articles
    async categorizeBatch(articles) {
        const prompt = await this._buildPrompt(articles);

        try {
            const response = await AI.call([
                { role: 'system', content: 'You are a precise news rating assistant. Always respond with valid JSON arrays only. No markdown, no extra text — just the JSON array.' },
                { role: 'user', content: prompt }
            ], {
                temperature: 0.15,
                max_tokens: 2048
            });

            let jsonStr = response.trim();

            // Clean markdown blocks
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }

            // Sometimes the model outputs extra text before the JSON array
            const braceIdx = jsonStr.indexOf('[');
            if (braceIdx > 0) {
                jsonStr = jsonStr.substring(braceIdx);
            }

            // Attempt to clean unescaped newlines/quotes inside strings if parsing fails
            let ratings;
            try {
                ratings = JSON.parse(jsonStr);
            } catch (e) {
                console.warn('Initial JSON parse failed, attempting strict cleanup...', e.message);
                // Aggressively strip invalid control characters
                jsonStr = jsonStr.replace(/[\u0000-\u0019]+/g, "");
                ratings = JSON.parse(jsonStr);
            }

            for (const rating of ratings) {
                const article = articles[rating.index];
                if (article && rating.stars >= 1 && rating.stars <= 5) {
                    await db.updateArticleStars(article.guid, rating.stars, rating.reason);
                }
            }

            // Sync star ratings to server
            await db.syncToServer();

            return ratings;
        } catch (error) {
            console.error('Categorization error:', error);
            throw error;
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
                await this.categorizeBatch(batches[i]);
                categorized += batches[i].length;
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
        const articleList = articles.map((a, i) => {
            return `[${i}] "${a.title}" (${a.feedTitle || 'Unknown'}, ${a.stars || '?'}★)`;
        }).join('\n');

        return `You are a news editor organizing a newsroom. Given these articles, do two things:

1. **GROUP exact duplicate stories** — articles covering the exact same specific news event should be grouped. Pick the BEST article as the "primary" (highest quality, most informative).
2. **ASSIGN 1-3 highly SPECIFIC EVENT tags** to each article. 
   - DO NOT use broad categories like "Global Politics", "India", "Technology", or "Sports". 
   - DO use specific, ongoing news events or subjects like "Russia-Ukraine War", "Tamil Nadu Pension Scheme", "ISRO PSLV Launch", "OpenAI Leadership Change", "Qatar Oil Prices", "German Chancellor Visit".
   - The goal is to cluster articles about the *exact same ongoing story together*.
   - Be consistent — use the EXACT SAME tag name for the same specific event across articles.

## ARTICLES:
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
- Articles NOT covering the exact same event as anything else should NOT appear in groups
- Every article MUST appear in topics (including grouped ones)
- Focus entirely on SPECIFIC EVENTS, PEOPLE, or DISCOVERIES, never high-level generic bins.
- Tags should be 2-4 words, title-cased`;
    },

    async groupAndTag(onProgress) {
        const articles = await db.getAllArticles();
        const untagged = articles.filter(a => !a.topics || a.topics.length === 0);
        if (untagged.length === 0) return { grouped: 0, tagged: 0 };

        let totalGrouped = 0;
        let totalTagged = 0;
        const batches = [];

        for (let i = 0; i < untagged.length; i += this.GROUP_BATCH_SIZE) {
            batches.push(untagged.slice(i, i + this.GROUP_BATCH_SIZE));
        }

        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            try {
                const prompt = await this._buildGroupPrompt(batch);
                const response = await AI.call([
                    { role: 'system', content: 'You are a precise news grouping assistant. Always respond with valid JSON only. No markdown, no extra text.' },
                    { role: 'user', content: prompt }
                ], { temperature: 0.1, max_tokens: 4096 });

                let jsonStr = response.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                }

                const result = JSON.parse(jsonStr);

                // Process groups — mark related articles with groupId pointing to primary
                if (result.groups) {
                    for (const group of result.groups) {
                        const primary = batch[group.primaryIndex];
                        if (!primary) continue;

                        const groupId = primary.guid;

                        // Mark primary as group leader
                        await db.updateArticleGroup(primary.guid, groupId, true, group.groupLabel, group.relatedIndices?.length || 0);

                        // Mark related as hidden (grouped under primary)
                        for (const relIdx of (group.relatedIndices || [])) {
                            const related = batch[relIdx];
                            if (related && related.guid !== primary.guid) {
                                await db.updateArticleGroup(related.guid, groupId, false, group.groupLabel, 0);
                                totalGrouped++;
                            }
                        }
                    }
                }

                // Process topics
                if (result.topics) {
                    for (const t of result.topics) {
                        const article = batch[t.index];
                        if (article && t.tags && t.tags.length > 0) {
                            await db.updateArticleTopics(article.guid, t.tags);
                            totalTagged++;
                        }
                    }
                }

                if (onProgress) onProgress({ batch: b + 1, totalBatches: batches.length, grouped: totalGrouped, tagged: totalTagged });

            } catch (error) {
                console.error(`Group batch ${b + 1} failed:`, error);
                if (onProgress) onProgress({ batch: b + 1, totalBatches: batches.length, error: error.message });
            }

            if (b < batches.length - 1) await Utils.sleep(1000);
        }

        await db.syncToServer();
        return { grouped: totalGrouped, tagged: totalTagged };
    },

    // ============================================
    // THIRD PASS: Group/Merge similar topics
    // ============================================
    async _buildTopicGroupingPrompt(topics) {
        const topicList = topics.map((t, i) => `[${i}] "${t.name}" (${t.count} articles)`).join('\n');
        
        return `You are a database organizer. Below is a list of news topics automatically generated by another AI.
Sometimes it creates duplicate or highly similar tags for the exact same entity or event.

Your task is to identify redundant topics and output a plan to MERGE them.
Wait to merge only if they refer to the EXACT SAME THING (e.g., "Artificial Intelligence" and "AI", or "US Elections" and "United States Elections"). DO NOT merge different but related things (e.g. "Apple" and "Microsoft").

## TOPICS LIST:
${topicList}

Respond with ONLY a valid JSON array of merges. If no merges are needed, return an empty array [].
Format:
[
  {
    "primary": "The standardized best name to keep",
    "aliases": ["Alias 1 to merge into primary", "Alias 2 to merge into primary"]
  }
]

IMPORTANT:
- Every string in "aliases" MUST EXACTLY MATCH a topic name from the TOPICS LIST.
- The "primary" name should also be an existing topic name, preferably the one with the most articles, or a much cleaner name.
- Do not add conversational text or markdown. Output raw JSON only.`;
    },

    async groupSimilarTopics() {
        const topics = await db.getAllTopics();
        if (topics.length < 2) return null; // Nothing to merge

        try {
            const prompt = await this._buildTopicGroupingPrompt(topics);
            const response = await AI.call([
                { role: 'system', content: 'You are a precise data deduplication assistant. Output ONLY valid JSON array.' },
                { role: 'user', content: prompt }
            ], { temperature: 0.0, max_tokens: 2000 });

            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }

            const merges = JSON.parse(jsonStr);
            if (!Array.isArray(merges) || merges.length === 0) {
                return { merged: 0, totalProcessed: topics.length };
            }

            // Perform merges in the database
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
            // Non-fatal, return silently
            return null;
        }
    }
};
