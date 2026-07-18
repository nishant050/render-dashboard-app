const MODULES = [
    {
        id: 'm1',
        course: 'Module 1',
        title: 'Market Mechanics',
        short: 'Orders, brokers, settlement',
        unlockAt: 0,
        assignment: 'Use market, limit, and stop-loss orders correctly before touching capital.',
        icon: 'landmark'
    },
    {
        id: 'm2',
        course: 'Module 2',
        title: 'Fundamental Research',
        short: 'Business quality, valuation',
        unlockAt: 5,
        assignment: 'Read company numbers and decide whether price, growth, debt, and quality agree.',
        icon: 'search-check'
    },
    {
        id: 'm3',
        course: 'Module 3',
        title: 'Technical Timing',
        short: 'Trend, levels, volume',
        unlockAt: 14,
        assignment: 'Time a fundamentally valid idea using support, resistance, volume, and invalidation.',
        icon: 'candlestick-chart'
    },
    {
        id: 'm4',
        course: 'Module 4',
        title: 'Risk And Mindset',
        short: 'Sizing, stops, emotions',
        unlockAt: 20,
        assignment: 'Trade only when the loss is planned and the mindset checklist is calm.',
        icon: 'shield-alert'
    },
    {
        id: 'm5',
        course: 'Module 5',
        title: 'Derivatives Desk',
        short: 'F&O, OI, Greeks',
        unlockAt: 25,
        assignment: 'Read a simple option chain and avoid trades where Greeks or OI contradict the idea.',
        icon: 'layers-3'
    },
    {
        id: 'm6',
        course: 'Module 6',
        title: 'Execution Routine',
        short: 'Plan, act, review',
        unlockAt: 30,
        assignment: 'Build a repeatable routine: research, plan, trade, journal, review.',
        icon: 'route'
    }
];

const QUESTION_BANK = {
    m1: [
        {
            topic: 'Order execution',
            question: 'A stock trades at 184. You want to buy only if it falls to 180 or lower. Which order best matches the plan?',
            options: ['Market buy order', 'Limit buy order at 180', 'Stop-loss sell order at 180', 'AMO market order'],
            answer: 1,
            explanation: 'A buy limit sets the maximum price you are willing to pay. A market order may fill near 184 or worse.'
        },
        {
            topic: 'Settlement',
            question: 'Why does T+1 settlement matter to a learner?',
            options: ['It changes candlestick colors', 'It controls when sold delivery funds are fully settled', 'It removes brokerage charges', 'It guarantees profit after one day'],
            answer: 1,
            explanation: 'Settlement affects cash availability and operational planning. It does not guarantee returns or remove costs.'
        },
        {
            topic: 'Circuit limits',
            question: 'A stock hits an upper circuit. What is the most realistic execution risk?',
            options: ['You can always buy instantly', 'Liquidity may disappear because sellers are absent', 'The exchange cancels all old trades', 'The price must fall the next day'],
            answer: 1,
            explanation: 'Circuit filters can freeze one side of the book. The lesson is liquidity risk, not a predictable next move.'
        },
        {
            topic: 'Broker charges',
            question: 'Which habit keeps a beginner from overtrading small capital?',
            options: ['Ignore charges below Rs 20', 'Estimate brokerage, taxes, and slippage before every trade', 'Use only market orders', 'Trade more when bored'],
            answer: 1,
            explanation: 'Costs and slippage compound quickly. The simulator rewards trades that include a planned cost and risk check.'
        },
        {
            topic: 'Investor vs trader',
            question: 'The cleanest difference between investing and trading is:',
            options: ['Investing needs no research', 'Trading is always intraday', 'The holding period, decision process, and risk rules differ', 'Investing means buying penny stocks'],
            answer: 2,
            explanation: 'Both need discipline. The process and time horizon decide whether you are analyzing a business or a setup.'
        }
    ],
    m2: [
        {
            topic: 'Valuation',
            question: 'A company has a P/E of 52 while earnings grow at 8 percent. What should you investigate first?',
            options: ['Whether growth can justify the premium', 'Whether the chart is green today', 'Whether the company pays dividends monthly', 'Whether the stock split last year'],
            answer: 0,
            explanation: 'High P/E is not automatically bad, but it must be supported by durable growth, quality, and future expectations.'
        },
        {
            topic: 'Debt',
            question: 'Debt/equity jumped from 0.4 to 1.8 in two years. What is the best interpretation?',
            options: ['Always bullish', 'A risk flag requiring cash-flow and interest-coverage checks', 'Meaningless for all businesses', 'A technical breakout signal'],
            answer: 1,
            explanation: 'Debt can fund expansion, but the learner must verify whether cash flows can service it through weak cycles.'
        },
        {
            topic: 'ROE',
            question: 'High ROE is most reliable when it comes with:',
            options: ['Heavy debt and falling sales', 'Consistent profits, reasonable leverage, and reinvestment opportunity', 'A low share price only', 'High promoter pledge'],
            answer: 1,
            explanation: 'ROE should be judged with leverage, durability, and growth runway. Debt can artificially inflate it.'
        },
        {
            topic: 'Sector rotation',
            question: 'If rates are falling and credit demand is improving, which research action makes sense?',
            options: ['Ignore macro completely', 'Screen rate-sensitive sectors and compare leaders', 'Buy the weakest sector blindly', 'Only trade options'],
            answer: 1,
            explanation: 'Macro gives a watchlist direction. Company quality and price still decide the trade.'
        },
        {
            topic: 'Cash flow',
            question: 'Profit rises but operating cash flow stays negative for three years. What is the main concern?',
            options: ['Accounting profit may not be converting into cash', 'The stock must be undervalued', 'The exchange will delist it immediately', 'Dividend yield will double'],
            answer: 0,
            explanation: 'Cash conversion is a serious quality check. The research drill asks the learner to compare profit with cash flow.'
        }
    ],
    m3: [
        {
            topic: 'Breakouts',
            question: 'A breakout above resistance is more reliable when:',
            options: ['Volume expands and price holds above the level', 'The candle is red', 'The stock is discussed on social media', 'The market is closed'],
            answer: 0,
            explanation: 'Volume and follow-through help confirm demand. A level without confirmation is only a line.'
        },
        {
            topic: 'Support',
            question: 'You buy near support. What must be defined before entry?',
            options: ['The exact loss point if support fails', 'The next TV headline', 'A promise never to sell', 'Only the target price'],
            answer: 0,
            explanation: 'Support is useful because it gives a clear invalidation area. Without invalidation, the trade is emotional.'
        },
        {
            topic: 'Candlesticks',
            question: 'A hammer candle is most meaningful when it forms:',
            options: ['At a random price', 'After a decline near demand/support', 'Only after a stock split', 'In every sideways market'],
            answer: 1,
            explanation: 'Candlestick patterns need location. The same candle at the wrong place has weak information value.'
        },
        {
            topic: 'Trend',
            question: 'Higher highs and higher lows usually describe:',
            options: ['A downtrend', 'An uptrend', 'A circuit filter', 'A settlement cycle'],
            answer: 1,
            explanation: 'Trend structure helps the learner avoid fighting the current direction without evidence of reversal.'
        },
        {
            topic: 'Volume',
            question: 'Price rises while volume keeps drying up. The cautious interpretation is:',
            options: ['Momentum may be weakening', 'Risk no longer exists', 'Debt/equity improved', 'The order will always fill'],
            answer: 0,
            explanation: 'Rising price with weak participation can fail. The simulator includes volume notes for this reason.'
        }
    ],
    m4: [
        {
            topic: 'Position sizing',
            question: 'Capital is 100,000 and max risk is 1 percent. Entry is 200 and stop is 190. What is the maximum quantity?',
            options: ['10 shares', '50 shares', '100 shares', '500 shares'],
            answer: 2,
            explanation: 'Risk budget is 1,000. Risk per share is 10, so maximum size is 100 shares before costs.'
        },
        {
            topic: 'Revenge trading',
            question: 'After two losses, the learner wants to double size to recover. The correct lab response is:',
            options: ['Allow it because confidence matters', 'Pause, review the plan, and respect daily loss limits', 'Buy the highest beta stock', 'Remove stop losses'],
            answer: 1,
            explanation: 'Revenge trading is an emotional state. The simulator trains a circuit breaker before the next order.'
        },
        {
            topic: 'Expectancy',
            question: 'A strategy wins 40 percent, average win is 3R, average loss is 1R. The expectancy is:',
            options: ['Positive', 'Negative', 'Zero because win rate is below 50 percent', 'Impossible to calculate'],
            answer: 0,
            explanation: '0.4 x 3R minus 0.6 x 1R equals +0.6R. Win rate alone does not decide quality.'
        },
        {
            topic: 'Stop loss',
            question: 'The best stop loss is placed where:',
            options: ['The pain feels unbearable', 'The trade thesis is proven wrong', 'The broker suggests randomly', 'The target is reached'],
            answer: 1,
            explanation: 'A stop is a thesis invalidation point. It should be planned before entry, not after fear appears.'
        },
        {
            topic: 'Journal',
            question: 'A useful trading journal records:',
            options: ['Only profit amount', 'Thesis, entry, stop, target, emotion, result, and lesson', 'Only screenshots', 'Only brokerage charges'],
            answer: 1,
            explanation: 'The journal turns outcomes into training data. This lab saves the decision note with every paper order.'
        }
    ],
    m5: [
        {
            topic: 'Options delta',
            question: 'An option delta of 0.55 roughly means:',
            options: ['The option may move about 0.55 for a 1 point move in the underlying', 'The option expires in 55 days', 'The option has no risk', 'The strike is guaranteed ITM'],
            answer: 0,
            explanation: 'Delta estimates directional sensitivity. It changes as price, time, and volatility change.'
        },
        {
            topic: 'Theta',
            question: 'Theta hurts the option buyer most when:',
            options: ['The trade takes too long without price movement', 'The market opens', 'The stock pays no dividend', 'The strike has high volume'],
            answer: 0,
            explanation: 'Time decay is a real cost. The derivative drill asks whether the move can happen fast enough.'
        },
        {
            topic: 'Open interest',
            question: 'Large call OI at a strike can often behave like:',
            options: ['A possible resistance zone', 'A guaranteed breakout', 'A company profit number', 'A tax slab'],
            answer: 0,
            explanation: 'OI is context, not certainty. Price action must confirm whether the zone is respected or broken.'
        },
        {
            topic: 'PCR',
            question: 'A very high put-call ratio should be treated as:',
            options: ['One sentiment input, not a standalone buy signal', 'A fixed profit formula', 'Proof that fundamentals improved', 'A way to avoid stop loss'],
            answer: 0,
            explanation: 'Option-chain signals need price, trend, volatility, and risk confirmation.'
        },
        {
            topic: 'Hedging',
            question: 'The most responsible use of derivatives for a beginner is first to understand:',
            options: ['Leverage, margin, Greeks, and maximum loss', 'Only the cheapest premium', 'Only social media tips', 'Only last traded price'],
            answer: 0,
            explanation: 'Derivatives amplify both speed and mistakes. The lab keeps them simulated and explanation-first.'
        }
    ],
    m6: [
        {
            topic: 'Pre-market routine',
            question: 'A useful pre-market plan contains:',
            options: ['Watchlist, levels, trigger, risk, and scenarios', 'Only yesterday profit', 'Only the loudest headline', 'Only one random stock'],
            answer: 0,
            explanation: 'Routine removes improvisation. The simulator rewards planned trades over impulse clicks.'
        },
        {
            topic: 'Capital allocation',
            question: 'Small capital should usually be trained with:',
            options: ['Concentration in one unknown penny stock', 'Few high-quality ideas, strict risk, and cost awareness', 'Maximum leverage', 'No records'],
            answer: 1,
            explanation: 'Survival matters first. Compounding cannot happen if early mistakes destroy capital.'
        },
        {
            topic: 'Exit planning',
            question: 'Before entry, the learner should know:',
            options: ['Only the buy price', 'Where to exit if right and where to exit if wrong', 'Only the company logo', 'Only the app color theme'],
            answer: 1,
            explanation: 'Both target and invalidation must exist before the order. Otherwise the exit becomes emotional.'
        },
        {
            topic: 'Review',
            question: 'A good weekly review asks:',
            options: ['Did I follow the plan even when the result was bad?', 'How can I avoid every loss forever?', 'Which stock moved most after I ignored it?', 'Can I remove all rules next week?'],
            answer: 0,
            explanation: 'Process quality is reviewable before outcomes become statistically meaningful.'
        },
        {
            topic: 'News filtering',
            question: 'A breaking headline should be traded only after:',
            options: ['Checking whether it changes earnings, risk, liquidity, or sentiment enough to alter the plan', 'Reading the headline alone', 'Buying before understanding', 'Ignoring position size'],
            answer: 0,
            explanation: 'News is useful only when converted into business impact, technical impact, or risk impact.'
        }
    ]
};

const COMPANIES = {
    NGRID: {
        symbol: 'NGRID',
        name: 'NorthGrid Energy',
        sector: 'Power transmission',
        price: 182.4,
        marketCap: '18,420 Cr',
        pe: 18.6,
        roe: 17.8,
        debtEquity: 0.72,
        revenueGrowth: 14.2,
        profitGrowth: 18.1,
        operatingMargin: 23.4,
        cashFlow: '820 Cr',
        promoterPledge: 0,
        currentRatio: 1.42,
        support: 176,
        resistance: 196,
        volumeNote: 'Delivery volume is 1.8x its 20-day average.',
        trend: 'Higher lows for 5 sessions',
        option: { pcr: 1.18, maxPain: 185, callWall: 200, putWall: 175, iv: 22.4 },
        story: 'Regulated assets, steady cash flows, and fresh transmission orders support the business. Debt is moderate, so rate sensitivity still matters.',
        risk: 'Tariff reset or delayed receivables can pressure cash flows.',
        seed: 8,
        volatility: 0.42
    },
    AUTON: {
        symbol: 'AUTON',
        name: 'AutoNova Mobility',
        sector: 'Auto components',
        price: 514.8,
        marketCap: '42,900 Cr',
        pe: 42.5,
        roe: 21.6,
        debtEquity: 0.18,
        revenueGrowth: 22.5,
        profitGrowth: 28.4,
        operatingMargin: 15.2,
        cashFlow: '1,240 Cr',
        promoterPledge: 0,
        currentRatio: 1.86,
        support: 488,
        resistance: 548,
        volumeNote: 'Breakout volume is healthy but price is stretched from support.',
        trend: 'Strong uptrend, 8 percent above short moving average',
        option: { pcr: 0.86, maxPain: 510, callWall: 550, putWall: 500, iv: 28.1 },
        story: 'Premium valuation is supported by growth and clean balance sheet. Entry discipline matters because price is extended.',
        risk: 'Margin can compress if raw material costs rise.',
        seed: 13,
        volatility: 0.68
    },
    ZENCH: {
        symbol: 'ZENCH',
        name: 'ZenChem Labs',
        sector: 'Specialty chemicals',
        price: 96.7,
        marketCap: '7,250 Cr',
        pe: 14.2,
        roe: 9.4,
        debtEquity: 1.56,
        revenueGrowth: 5.3,
        profitGrowth: -11.8,
        operatingMargin: 10.1,
        cashFlow: '-160 Cr',
        promoterPledge: 8.5,
        currentRatio: 0.92,
        support: 91,
        resistance: 108,
        volumeNote: 'Volume spikes appear on down days, which warns of supply.',
        trend: 'Sideways with lower highs',
        option: { pcr: 0.74, maxPain: 100, callWall: 110, putWall: 90, iv: 34.8 },
        story: 'Valuation looks low, but debt, weak cash flow, and falling profit explain part of the discount.',
        risk: 'Debt refinancing and export slowdown can keep valuation depressed.',
        seed: 21,
        volatility: 0.82
    },
    SOFTQ: {
        symbol: 'SOFTQ',
        name: 'SoftQuest Platforms',
        sector: 'Software services',
        price: 1268.5,
        marketCap: '78,600 Cr',
        pe: 29.4,
        roe: 26.2,
        debtEquity: 0.02,
        revenueGrowth: 11.8,
        profitGrowth: 13.9,
        operatingMargin: 29.6,
        cashFlow: '4,480 Cr',
        promoterPledge: 0,
        currentRatio: 2.34,
        support: 1210,
        resistance: 1325,
        volumeNote: 'Volume is average; institutions are waiting for guidance.',
        trend: 'Range-bound after a long base',
        option: { pcr: 1.04, maxPain: 1270, callWall: 1320, putWall: 1220, iv: 19.7 },
        story: 'High quality balance sheet and cash flow, but growth is steady rather than explosive.',
        risk: 'Currency movement and weak client spending can slow upgrades.',
        seed: 34,
        volatility: 0.38
    },
    RETLY: {
        symbol: 'RETLY',
        name: 'RetailYard Consumer',
        sector: 'Consumer retail',
        price: 238.2,
        marketCap: '22,180 Cr',
        pe: 61.3,
        roe: 13.8,
        debtEquity: 0.44,
        revenueGrowth: 31.2,
        profitGrowth: 7.6,
        operatingMargin: 7.8,
        cashFlow: '120 Cr',
        promoterPledge: 2.1,
        currentRatio: 1.18,
        support: 224,
        resistance: 252,
        volumeNote: 'High volume comes after store-expansion news.',
        trend: 'Fast recovery but margin pressure remains',
        option: { pcr: 0.92, maxPain: 240, callWall: 250, putWall: 225, iv: 31.4 },
        story: 'Sales growth is strong, but valuation is demanding and margins are thin.',
        risk: 'Execution risk from aggressive expansion.',
        seed: 55,
        volatility: 0.76
    }
};

const RESEARCH_PAGES = [
    { id: 'snapshot', label: 'Quote', icon: 'panel-top' },
    { id: 'financials', label: 'Financials', icon: 'table-2' },
    { id: 'annual', label: 'Annual Report', icon: 'file-text' },
    { id: 'chart', label: 'Chart Notes', icon: 'trending-up' },
    { id: 'options', label: 'Option Chain', icon: 'list-tree' }
];

const ASSIGNMENTS = {
    m1: {
        focus: 'Execution mechanics',
        prompt: 'Choose the right order type and explain how settlement, liquidity, and stop placement affect the trade.',
        checklist: ['Use a limit order when price matters', 'Avoid illiquid circuit situations', 'Mention settlement or funds availability']
    },
    m2: {
        focus: 'Fundamental decision',
        prompt: 'Decide whether this company deserves research capital using valuation, growth, debt, cash flow, and quality.',
        checklist: ['Compare P/E with growth', 'Check ROE with debt', 'Explain cash-flow quality']
    },
    m3: {
        focus: 'Entry timing',
        prompt: 'Create an entry plan using support, resistance, trend, and volume. Do not chase stretched prices.',
        checklist: ['Define trigger', 'Define invalidation', 'Use volume confirmation']
    },
    m4: {
        focus: 'Risk and emotion control',
        prompt: 'Convert the idea into position size, stop loss, maximum loss, and an emotional circuit breaker.',
        checklist: ['Risk 1 percent or less', 'Write what proves you wrong', 'Name the emotion to avoid']
    },
    m5: {
        focus: 'Derivatives reading',
        prompt: 'Read the option chain as context only. Explain PCR, call wall, put wall, IV, and theta risk before any F&O idea.',
        checklist: ['Do not treat OI as certainty', 'Mention time decay', 'Compare OI levels with price action']
    },
    m6: {
        focus: 'Full routine',
        prompt: 'Build the complete routine: research thesis, entry trigger, risk, execution, journal, and review rule.',
        checklist: ['Use a repeatable checklist', 'Plan both exits', 'Review process, not only P&L']
    }
};

const MARKET_EVENTS = [
    { tick: 2, symbol: 'NGRID', impact: 0.65, headline: 'Transmission order worth 1,200 Cr announced', lesson: 'Order inflow can support future revenue, but execution and margins still matter.' },
    { tick: 4, symbol: 'ZENCH', impact: -1.25, headline: 'Working capital stress flagged by auditor note', lesson: 'Low P/E can be a trap when cash flow and leverage are weak.' },
    { tick: 6, symbol: 'AUTON', impact: 0.9, headline: 'EV component exports beat estimates', lesson: 'Growth surprise helps, but a stretched chart still needs entry discipline.' },
    { tick: 8, symbol: 'RETLY', impact: -0.85, headline: 'Store expansion lifts sales but hurts margins', lesson: 'Revenue growth without margin translation can disappoint.' },
    { tick: 10, symbol: 'SOFTQ', impact: 0.55, headline: 'Large client renewal improves earnings visibility', lesson: 'Quality companies may move slowly but reward patience around levels.' },
    { tick: 13, symbol: 'AUTON', impact: -0.8, headline: 'Profit booking appears near resistance', lesson: 'Resistance matters most when price is extended and volume fades.' },
    { tick: 16, symbol: 'NGRID', impact: -0.45, headline: 'Bond yields rise in afternoon trade', lesson: 'Rate-sensitive businesses can react to macro even when company news is good.' },
    { tick: 18, symbol: 'SOFTQ', impact: 0.7, headline: 'Breakout attempt above consolidation range', lesson: 'A breakout needs follow-through and volume before adding size.' }
];

const DEFAULT_SYMBOL = 'NGRID';
const GUEST_PROFILE_ID = '__guest_investing_lab__';

const app = {
    learnState: { profiles: {}, currentProfileId: null },
    labState: { profiles: {} },
    profileId: null,
    guest: false,
    view: 'tests',
    activeModuleId: 'm1',
    activeQuestionIndex: 0,
    selectedCompany: DEFAULT_SYMBOL,
    selectedResearchPage: 'snapshot',
    selectedSymbol: DEFAULT_SYMBOL,
    marketTimer: null,
    saveTimer: null,
    toastTimer: null,
    isSaving: false
};

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('resize', () => requestAnimationFrame(drawMarketChart));

async function init() {
    bindChromeEvents();
    bindWorkspaceEvents();
    await loadState();
    render();
}

function bindChromeEvents() {
    document.getElementById('profileSelect').addEventListener('change', event => {
        const value = event.target.value;
        if (value === GUEST_PROFILE_ID) {
            app.guest = true;
            app.profileId = GUEST_PROFILE_ID;
        } else {
            app.guest = false;
            app.profileId = value || null;
        }
        ensureActiveProfile();
        render();
    });

    document.getElementById('guestModeButton').addEventListener('click', () => {
        app.guest = !app.guest;
        app.profileId = app.guest ? GUEST_PROFILE_ID : findInitialProfileId();
        ensureActiveProfile();
        render();
        showToast(app.guest ? 'Guest Mode is on. Progress will not be saved.' : 'Guest Mode is off. Real profile progress is active.');
    });

    document.getElementById('refreshButton').addEventListener('click', async () => {
        await loadState({ keepProfile: true });
        render();
        showToast('Course progress synced.');
    });
}

function bindWorkspaceEvents() {
    document.addEventListener('click', event => {
        const viewButton = event.target.closest('[data-view]');
        if (viewButton) {
            app.view = viewButton.dataset.view;
            activeProfile().activeView = app.view;
            saveSoon();
            render();
            return;
        }

        const moduleButton = event.target.closest('[data-module]');
        if (moduleButton) {
            const moduleId = moduleButton.dataset.module;
            if (!isModuleUnlocked(getModule(moduleId))) {
                showToast('Complete more course lessons or use Guest Mode to test this module.');
                return;
            }
            app.activeModuleId = moduleId;
            app.activeQuestionIndex = 0;
            activeProfile().activeModuleId = moduleId;
            saveSoon();
            render();
            return;
        }

        const answerButton = event.target.closest('[data-answer-index]');
        if (answerButton) {
            selectAnswer(Number(answerButton.dataset.answerIndex));
            return;
        }

        const symbolRow = event.target.closest('[data-symbol]');
        if (symbolRow) {
            const symbol = symbolRow.dataset.symbol;
            app.selectedSymbol = symbol;
            activeProfile().sim.selectedSymbol = symbol;
            saveSoon();
            render();
            return;
        }

        const companyButton = event.target.closest('[data-company]');
        if (companyButton) {
            app.selectedCompany = companyButton.dataset.company;
            activeProfile().research.selectedCompany = app.selectedCompany;
            saveSoon();
            render();
            return;
        }

        const pageButton = event.target.closest('[data-page]');
        if (pageButton) {
            app.selectedResearchPage = pageButton.dataset.page;
            activeProfile().research.selectedPage = app.selectedResearchPage;
            saveSoon();
            render();
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
            handleAction(actionButton.dataset.action);
        }
    });
}

function handleAction(action) {
    const handlers = {
        prevQuestion: () => {
            app.activeQuestionIndex = Math.max(0, app.activeQuestionIndex - 1);
            render();
        },
        nextQuestion: () => {
            const maxIndex = getQuestions().length - 1;
            app.activeQuestionIndex = Math.min(maxIndex, app.activeQuestionIndex + 1);
            render();
        },
        submitAnswer,
        resetTest,
        saveWorksheet,
        aiCoach: requestAIFeedback,
        sendToSim,
        startMarket,
        pauseMarket,
        nextTick: () => {
            advanceMarket();
            render();
        },
        placeOrder: placeOrderFromTicket,
        resetSim,
        closeAll: closeAllPositions
    };

    const handler = handlers[action];
    if (handler) handler();
}

async function loadState(options = {}) {
    try {
        const [learnState, labState] = await Promise.all([
            fetchJson('/api/learn-investing/state'),
            fetchJson('/api/investing-lab/state')
        ]);

        app.learnState = normalizeLearnState(learnState);
        app.labState = normalizeLabState(labState);
    } catch (error) {
        console.warn('Investing lab state fallback:', error);
        app.learnState = readLocalJson('stockMarketCourseProfiles')
            ? {
                profiles: readLocalJson('stockMarketCourseProfiles') || {},
                currentProfileId: localStorage.getItem('stockMarketCourseCurrentProfile')
            }
            : { profiles: {}, currentProfileId: null };
        app.labState = { profiles: readLocalJson('investingLabProfiles') || {} };
        showToast('Using local cache because MongoDB state could not be reached.');
    }

    if (!options.keepProfile || (!app.profileId && !app.guest)) {
        app.profileId = app.guest ? GUEST_PROFILE_ID : findInitialProfileId();
    }

    ensureActiveProfile();
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
    return response.json();
}

function normalizeLearnState(state) {
    return {
        profiles: isObject(state && state.profiles) ? state.profiles : {},
        currentProfileId: state && state.currentProfileId ? state.currentProfileId : null
    };
}

function normalizeLabState(state) {
    return {
        profiles: isObject(state && state.profiles) ? state.profiles : {}
    };
}

function findInitialProfileId() {
    const current = app.learnState.currentProfileId;
    if (current && app.learnState.profiles[current]) return current;
    return Object.keys(app.learnState.profiles)[0] || null;
}

function ensureActiveProfile() {
    if (app.guest) {
        app.labState.profiles[GUEST_PROFILE_ID] = normalizeProfileState(app.labState.profiles[GUEST_PROFILE_ID], true);
        app.view = app.labState.profiles[GUEST_PROFILE_ID].activeView || 'tests';
        app.activeModuleId = app.labState.profiles[GUEST_PROFILE_ID].activeModuleId || 'm1';
        syncSelectionsFromProfile();
        return;
    }

    if (!app.profileId) return;
    app.labState.profiles[app.profileId] = normalizeProfileState(app.labState.profiles[app.profileId], false);
    app.view = app.labState.profiles[app.profileId].activeView || 'tests';
    app.activeModuleId = app.labState.profiles[app.profileId].activeModuleId || 'm1';

    if (!isModuleUnlocked(getModule(app.activeModuleId))) {
        app.activeModuleId = firstUnlockedModule().id;
        app.labState.profiles[app.profileId].activeModuleId = app.activeModuleId;
    }

    syncSelectionsFromProfile();
}

function syncSelectionsFromProfile() {
    const profile = activeProfile();
    if (!profile) return;
    app.selectedCompany = profile.research.selectedCompany || DEFAULT_SYMBOL;
    app.selectedResearchPage = profile.research.selectedPage || 'snapshot';
    app.selectedSymbol = profile.sim.selectedSymbol || DEFAULT_SYMBOL;
}

function createProfileState() {
    return {
        activeView: 'tests',
        activeModuleId: 'm1',
        practiceDays: [],
        tests: {},
        research: {
            selectedCompany: DEFAULT_SYMBOL,
            selectedPage: 'snapshot',
            worksheets: {},
            aiFeedback: {}
        },
        sim: createSimState()
    };
}

function normalizeProfileState(raw = {}, isGuest = false) {
    const base = createProfileState();
    const source = isObject(raw) ? raw : {};
    const profile = {
        ...base,
        ...source,
        tests: isObject(source.tests) ? source.tests : {},
        research: {
            ...base.research,
            ...(isObject(source.research) ? source.research : {}),
            worksheets: isObject(source.research && source.research.worksheets) ? source.research.worksheets : {},
            aiFeedback: isObject(source.research && source.research.aiFeedback) ? source.research.aiFeedback : {}
        },
        sim: normalizeSimState(source.sim),
        practiceDays: Array.isArray(source.practiceDays) ? source.practiceDays : []
    };

    if (isGuest) {
        profile.practiceDays = profile.practiceDays || [];
    }

    return profile;
}

function createSimState() {
    const histories = {};
    Object.values(COMPANIES).forEach(company => {
        histories[company.symbol] = seedHistory(company);
    });

    return {
        initialCash: 100000,
        cash: 100000,
        tick: 0,
        running: false,
        selectedSymbol: DEFAULT_SYMBOL,
        histories,
        positions: {},
        orders: [],
        feed: [],
        journal: []
    };
}

function normalizeSimState(raw = {}) {
    const base = createSimState();
    const source = isObject(raw) ? raw : {};
    const sim = {
        ...base,
        ...source,
        histories: isObject(source.histories) ? source.histories : base.histories,
        positions: isObject(source.positions) ? source.positions : {},
        orders: Array.isArray(source.orders) ? source.orders : [],
        feed: Array.isArray(source.feed) ? source.feed : [],
        journal: Array.isArray(source.journal) ? source.journal : []
    };

    Object.values(COMPANIES).forEach(company => {
        if (!Array.isArray(sim.histories[company.symbol]) || sim.histories[company.symbol].length < 2) {
            sim.histories[company.symbol] = seedHistory(company);
        }
    });

    if (!COMPANIES[sim.selectedSymbol]) sim.selectedSymbol = DEFAULT_SYMBOL;
    return sim;
}

function seedHistory(company) {
    const points = [];
    let price = company.price * 0.982;
    for (let i = 0; i < 18; i++) {
        const wave = Math.sin((i + company.seed) / 3.2) * company.volatility;
        const noise = (pseudoRandom(i, company.seed) - 0.5) * company.volatility;
        price = Math.max(5, price * (1 + (wave + noise) / 500));
        points.push({ tick: i - 17, price: round(price) });
    }
    points.push({ tick: 0, price: company.price });
    return points;
}

function activeProfile() {
    if (app.guest) return app.labState.profiles[GUEST_PROFILE_ID];
    if (!app.profileId) return null;
    return app.labState.profiles[app.profileId];
}

function activeLearnProfile() {
    if (app.guest) {
        return { id: GUEST_PROFILE_ID, name: 'Guest Learner', progress: { completedVideos: [] } };
    }
    return app.learnState.profiles[app.profileId] || null;
}

function render() {
    ensureActiveProfile();
    renderChrome();

    const profile = activeProfile();
    if (!profile) {
        document.getElementById('workspace').innerHTML = renderNoProfile();
        refreshIcons();
        return;
    }

    const module = getModule(app.activeModuleId);
    if (!isModuleUnlocked(module)) {
        document.getElementById('workspace').innerHTML = renderLockedModule(module);
        refreshIcons();
        return;
    }

    const renderers = {
        tests: renderTests,
        research: renderResearch,
        simulator: renderSimulator
    };

    document.getElementById('workspace').innerHTML = (renderers[app.view] || renderTests)();
    refreshIcons();
    if (app.view === 'simulator') requestAnimationFrame(drawMarketChart);
}

function renderChrome() {
    const profileSelect = document.getElementById('profileSelect');
    const learnProfile = activeLearnProfile();
    const labProfile = activeProfile();
    const completedCount = app.guest ? totalCourseLessons() : getCompletedVideos(learnProfile).length;
    const unlockedCount = MODULES.filter(isModuleUnlocked).length;
    const stats = labProfile ? computeStats(labProfile) : { mastery: 0, xp: 0, badges: [], testScore: 0, trades: 0, worksheets: 0 };

    profileSelect.innerHTML = [
        ...Object.values(app.learnState.profiles).map(profile => `<option value="${escapeAttr(profile.id)}">${escapeHTML(profile.name || 'Learner')}</option>`),
        `<option value="${GUEST_PROFILE_ID}">Guest Mode - unlocked sandbox</option>`
    ].join('');
    profileSelect.value = app.guest ? GUEST_PROFILE_ID : (app.profileId || '');

    document.getElementById('guestModeButton').classList.toggle('is-active', app.guest);
    document.getElementById('profileAvatar').textContent = initials(learnProfile ? learnProfile.name : 'Investing Training');
    document.getElementById('profileName').textContent = learnProfile ? learnProfile.name : 'No profile selected';
    document.getElementById('courseProgressText').textContent = app.guest
        ? 'Guest sandbox has every module unlocked and never saves progress.'
        : `${completedCount} course lessons completed. ${unlockedCount} of ${MODULES.length} lab modules unlocked.`;
    document.getElementById('masteryValue').textContent = `${stats.mastery}%`;
    document.getElementById('masteryBar').style.width = `${stats.mastery}%`;
    document.getElementById('statsRow').innerHTML = [
        statPill('zap', `${stats.xp} XP`),
        statPill('clipboard-check', `${stats.testScore}% tests`),
        statPill('search', `${stats.worksheets} research drills`),
        statPill('activity', `${stats.trades} paper trades`)
    ].join('');

    document.getElementById('moduleTimeline').innerHTML = MODULES.map(module => {
        const locked = !isModuleUnlocked(module);
        const active = app.activeModuleId === module.id;
        return `
            <button class="timeline-chip ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}" data-module="${module.id}" type="button" ${locked ? 'aria-disabled="true"' : ''}>
                <i data-lucide="${locked ? 'lock' : module.icon}"></i>
                <span>
                    <strong>${module.course}: ${module.title}</strong>
                    <span>${locked ? `Unlock after ${module.unlockAt} lessons` : module.short}</span>
                </span>
            </button>
        `;
    }).join('');

    document.querySelectorAll('.mode-button').forEach(button => {
        button.classList.toggle('is-active', button.dataset.view === app.view);
    });
}

function renderNoProfile() {
    return `
        <div class="empty-state">
            <div>
                <h2>Select a learner profile or use Guest Mode</h2>
                <p>The lab reads progress from learn-investing. Guest Mode unlocks every simulator, test, and research drill without saving over a real learner.</p>
                <div class="action-row" style="justify-content:center">
                    <button class="tool-button primary" type="button" onclick="document.getElementById('guestModeButton').click()">
                        <i data-lucide="shield-check"></i>
                        <span>Start Guest Mode</span>
                    </button>
                    <a class="tool-button" href="../learn-investing/index.html">
                        <i data-lucide="book-open"></i>
                        <span>Open Course</span>
                    </a>
                </div>
            </div>
        </div>
    `;
}

function renderLockedModule(module) {
    return `
        <div class="lock-state">
            <div>
                <h2>${escapeHTML(module.title)} is locked</h2>
                <p>Complete ${module.unlockAt} course lessons in learn-investing to unlock this lab module, or switch on Guest Mode to test the app without changing learner progress.</p>
                <div class="action-row" style="justify-content:center">
                    <a class="tool-button primary" href="../learn-investing/index.html">
                        <i data-lucide="book-open"></i>
                        <span>Continue Course</span>
                    </a>
                    <button class="tool-button" type="button" onclick="document.getElementById('guestModeButton').click()">
                        <i data-lucide="shield-check"></i>
                        <span>Guest Mode</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderTests() {
    const module = getModule(app.activeModuleId);
    const profile = activeProfile();
    const questions = getQuestions();
    const test = getTestState(profile, module.id);
    const index = Math.min(app.activeQuestionIndex, questions.length - 1);
    const question = questions[index];
    const selected = test.answers[index];
    const submitted = Boolean(test.submitted[index]);
    const score = getTestScore(test, questions);
    const answeredCount = Object.keys(test.submitted).length;

    return `
        <div class="page-heading">
            <div>
                <h2>${module.title} Tests</h2>
                <p>Question-answer practice, scenario checks, and exact explanations. Pass the module test before using the simulator for this chapter.</p>
            </div>
            <span class="summary-pill"><i data-lucide="graduation-cap"></i>${answeredCount}/${questions.length} answered</span>
        </div>

        <div class="test-grid">
            <aside class="panel">
                <div class="panel-title">
                    <h2>Test bank</h2>
                    <span class="status-pill ${score >= 70 ? 'green' : 'amber'}">${score}% score</span>
                </div>
                <div class="list-stack">
                    ${questions.map((item, questionIndex) => {
                        const isActive = questionIndex === index;
                        const isDone = test.submitted[questionIndex];
                        const isCorrect = isDone && test.answers[questionIndex] === item.answer;
                        return `
                            <button class="chip-button ${isActive ? 'is-active' : ''}" type="button" data-action="jumpQuestion" onclick="window.investingLabJumpQuestion(${questionIndex})">
                                <i data-lucide="${isDone ? (isCorrect ? 'check-circle-2' : 'circle-alert') : 'circle'}"></i>
                                <span>
                                    <strong>Q${questionIndex + 1}. ${escapeHTML(item.topic)}</strong>
                                    <span>${isDone ? (isCorrect ? 'Correct' : 'Review explanation') : 'Not answered'}</span>
                                </span>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="action-row" style="margin-top:14px">
                    <button class="tool-button" type="button" data-action="resetTest">
                        <i data-lucide="rotate-ccw"></i>
                        <span>Reset Test</span>
                    </button>
                </div>
            </aside>

            <section class="panel question-card">
                <div class="panel-title">
                    <h2>${module.course} Assignment Gate</h2>
                    <span class="summary-pill"><i data-lucide="target"></i>${escapeHTML(module.assignment)}</span>
                </div>
                <p class="label">Question ${index + 1} of ${questions.length}</p>
                <h3>${escapeHTML(question.question)}</h3>
                <div class="choice-grid">
                    ${question.options.map((option, optionIndex) => {
                        const isSelected = selected === optionIndex;
                        const isCorrect = submitted && optionIndex === question.answer;
                        const isWrong = submitted && isSelected && optionIndex !== question.answer;
                        return `
                            <button class="choice-button ${isSelected ? 'is-selected' : ''} ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''}" data-answer-index="${optionIndex}" type="button">
                                <strong>${String.fromCharCode(65 + optionIndex)}.</strong>
                                <span>${escapeHTML(option)}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
                ${submitted ? `<div class="explanation">${escapeHTML(question.explanation)}</div>` : ''}
                <div class="action-row">
                    <button class="tool-button" type="button" data-action="prevQuestion" ${index === 0 ? 'disabled' : ''}>
                        <i data-lucide="arrow-left"></i>
                        <span>Previous</span>
                    </button>
                    <button class="tool-button primary" type="button" data-action="submitAnswer" ${selected == null ? 'disabled' : ''}>
                        <i data-lucide="check"></i>
                        <span>${submitted ? 'Recheck' : 'Submit'}</span>
                    </button>
                    <button class="tool-button" type="button" data-action="nextQuestion" ${index === questions.length - 1 ? 'disabled' : ''}>
                        <span>Next</span>
                        <i data-lucide="arrow-right"></i>
                    </button>
                </div>
            </section>
        </div>

        ${renderRewards()}
    `;
}

function renderResearch() {
    const module = getModule(app.activeModuleId);
    const assignment = ASSIGNMENTS[module.id];
    const profile = activeProfile();
    const company = COMPANIES[app.selectedCompany] || COMPANIES[DEFAULT_SYMBOL];
    const worksheet = getWorksheet(profile, company.symbol);
    const feedback = profile.research.aiFeedback[company.symbol];

    return `
        <div class="page-heading">
            <div>
                <h2>${module.title} Research Drill</h2>
                <p>${escapeHTML(assignment.prompt)} The websites below are simulated so the learner can practice reading numbers before opening a real broker or screener.</p>
            </div>
            <span class="summary-pill"><i data-lucide="search-check"></i>${escapeHTML(assignment.focus)}</span>
        </div>

        <div class="research-grid">
            <aside class="panel">
                <div class="panel-title">
                    <h2>Research assignment</h2>
                    <span class="status-pill amber">Practice case</span>
                </div>
                <div class="list-stack">
                    ${Object.values(COMPANIES).map(item => `
                        <button class="chip-button ${item.symbol === company.symbol ? 'is-active' : ''}" type="button" data-company="${item.symbol}">
                            <i data-lucide="building-2"></i>
                            <span>
                                <strong>${item.symbol} - ${escapeHTML(item.name)}</strong>
                                <span>${escapeHTML(item.sector)} | P/E ${item.pe} | ROE ${item.roe}%</span>
                            </span>
                        </button>
                    `).join('')}
                </div>
                <div class="soft-panel panel" style="margin-top:14px">
                    <div class="panel-title">
                        <h2>Checklist</h2>
                    </div>
                    <div class="list-stack">
                        ${assignment.checklist.map(item => `<div class="mini-row"><span>${escapeHTML(item)}</span><i data-lucide="circle-dot"></i></div>`).join('')}
                    </div>
                </div>
            </aside>

            <section class="grid-2">
                <div class="browser-frame">
                    <div class="browser-bar">
                        <span class="browser-dot"></span>
                        <span class="browser-dot"></span>
                        <span class="browser-dot"></span>
                        <span class="browser-url">research.sim/${company.symbol.toLowerCase()}/${app.selectedResearchPage}</span>
                    </div>
                    <div class="tab-row">
                        ${RESEARCH_PAGES.map(page => `
                            <button class="tab-button ${page.id === app.selectedResearchPage ? 'is-active' : ''}" data-page="${page.id}" type="button">
                                <i data-lucide="${page.icon}"></i>
                                <span>${page.label}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="browser-content">
                        ${renderResearchPage(company, app.selectedResearchPage)}
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-title">
                        <h2>Student interpretation</h2>
                        <span class="status-pill ${worksheet.thesis ? 'green' : 'amber'}">${worksheet.thesis ? 'Saved' : 'Draft'}</span>
                    </div>
                    <div class="field-grid">
                        <label class="field">
                            <span>Decision</span>
                            <select id="decisionInput">
                                ${['Wait', 'Research more', 'Paper buy', 'Avoid', 'Paper sell'].map(value => `<option ${worksheet.decision === value ? 'selected' : ''}>${value}</option>`).join('')}
                            </select>
                        </label>
                        <label class="field">
                            <span>Thesis in plain English</span>
                            <textarea id="thesisInput" placeholder="Example: Quality is strong, valuation is fair, but I will wait for price near support.">${escapeHTML(worksheet.thesis || '')}</textarea>
                        </label>
                        <label class="field">
                            <span>Risk and opposite evidence</span>
                            <textarea id="riskInput" placeholder="What would prove your idea wrong? What number worries you?">${escapeHTML(worksheet.risk || '')}</textarea>
                        </label>
                        <div class="ticket-grid">
                            <label class="field">
                                <span>Entry</span>
                                <input id="entryInput" type="number" min="1" step="0.05" value="${escapeAttr(worksheet.entry || '')}" placeholder="${company.support}">
                            </label>
                            <label class="field">
                                <span>Stop</span>
                                <input id="stopInput" type="number" min="1" step="0.05" value="${escapeAttr(worksheet.stop || '')}" placeholder="${round(company.support * 0.97)}">
                            </label>
                            <label class="field">
                                <span>Target</span>
                                <input id="targetInput" type="number" min="1" step="0.05" value="${escapeAttr(worksheet.target || '')}" placeholder="${company.resistance}">
                            </label>
                        </div>
                        <label class="field">
                            <span>Confidence: ${worksheet.confidence || 50}%</span>
                            <input id="confidenceInput" type="range" min="0" max="100" step="5" value="${worksheet.confidence || 50}">
                        </label>
                        <div class="action-row">
                            <button class="tool-button primary" type="button" data-action="saveWorksheet">
                                <i data-lucide="save"></i>
                                <span>Save Research</span>
                            </button>
                            <button class="tool-button" type="button" data-action="aiCoach">
                                <i data-lucide="sparkles"></i>
                                <span>AI Coach</span>
                            </button>
                            <button class="tool-button" type="button" data-action="sendToSim">
                                <i data-lucide="send"></i>
                                <span>Send To Simulator</span>
                            </button>
                        </div>
                    </div>
                    ${feedback ? `
                        <div class="soft-panel panel" style="margin-top:14px">
                            <div class="panel-title">
                                <h2>Coach feedback</h2>
                                <span class="status-pill ${feedback.source === 'ai' ? 'green' : 'amber'}">${feedback.source === 'ai' ? 'AI' : (feedback.source === 'loading' ? 'Reviewing' : 'Rule-based')}</span>
                            </div>
                            <div class="ai-feedback">${escapeHTML(feedback.feedback)}</div>
                        </div>
                    ` : ''}
                </div>
            </section>
        </div>
    `;
}

function renderResearchPage(company, pageId) {
    const pages = {
        snapshot: () => `
            <div class="panel-title">
                <h2>${company.symbol} Quote Snapshot</h2>
                <span class="summary-pill">${escapeHTML(company.sector)}</span>
            </div>
            <div class="metric-grid">
                ${metric('Last price', formatMoney(company.price), 'The current reference price. Do not decide from price alone; compare it with value and levels.')}
                ${metric('Market cap', company.marketCap, 'Size helps you judge maturity, liquidity, and growth runway.')}
                ${metric('P/E', `${company.pe}x`, 'How much investors pay for current earnings. High P/E needs stronger future growth.')}
                ${metric('ROE', `${company.roe}%`, 'Shows profit generated on shareholder capital. Check whether debt is inflating it.')}
                ${metric('Debt/equity', company.debtEquity, 'Higher leverage increases risk in weak cycles. Compare with cash flow and sector norms.')}
                ${metric('Promoter pledge', `${company.promoterPledge}%`, 'High pledge can create forced-selling risk. Zero or low pledge is cleaner.')}
            </div>
        `,
        financials: () => `
            <div class="panel-title">
                <h2>Financial Statement Practice</h2>
                <span class="summary-pill">Numbers to interpret</span>
            </div>
            <div class="metric-grid">
                ${metric('Revenue growth', `${company.revenueGrowth}%`, 'Sales growth shows demand. It matters more when profit and cash flow follow.')}
                ${metric('Profit growth', `${company.profitGrowth}%`, 'Profit growth reveals operating leverage or margin pressure. Negative growth needs caution.')}
                ${metric('Operating margin', `${company.operatingMargin}%`, 'Margin shows pricing power and cost control. Compare trend, not just one year.')}
                ${metric('Operating cash flow', company.cashFlow, 'Cash flow checks whether accounting profit is turning into usable cash.')}
                ${metric('Current ratio', company.currentRatio, 'Short-term liquidity. Below 1 can signal working-capital stress.')}
                ${metric('Quality read', qualityRead(company), 'A quick synthesis. The learner must still explain the why in the worksheet.')}
            </div>
        `,
        annual: () => `
            <div class="panel-title">
                <h2>Simulated Annual Report Notes</h2>
                <span class="summary-pill">Management discussion</span>
            </div>
            <div class="list-stack">
                <div class="news-item"><strong>Business story</strong><p>${escapeHTML(company.story)}</p></div>
                <div class="news-item"><strong>Main risk</strong><p>${escapeHTML(company.risk)}</p></div>
                <div class="news-item"><strong>What to look for</strong><p>Does management explain growth in numbers, or only in optimistic language? Check margins, cash flow, debt, and capital allocation.</p></div>
                <div class="news-item"><strong>Interpretation rule</strong><p>A strong report connects strategy to measurable results. A weak report avoids numbers or explains away repeated cash-flow weakness.</p></div>
            </div>
        `,
        chart: () => `
            <div class="panel-title">
                <h2>Technical Reading Desk</h2>
                <span class="summary-pill">Timing only</span>
            </div>
            <div class="metric-grid">
                ${metric('Support', formatMoney(company.support), 'Area where demand recently appeared. If it breaks, the trade thesis may be wrong.')}
                ${metric('Resistance', formatMoney(company.resistance), 'Area where supply recently appeared. Breakouts need volume and follow-through.')}
                ${metric('Trend', company.trend, 'Trend tells whether you are trading with or against current market behavior.')}
                ${metric('Volume read', company.volumeNote, 'Volume confirms whether a price move has real participation.')}
            </div>
        `,
        options: () => `
            <div class="panel-title">
                <h2>Option Chain Simulator</h2>
                <span class="summary-pill">Context, not certainty</span>
            </div>
            <div class="metric-grid">
                ${metric('PCR', company.option.pcr, 'Put-call ratio is a sentiment input. Extreme readings need confirmation from price.')}
                ${metric('Max pain', formatMoney(company.option.maxPain), 'The strike where option writers theoretically have least payout. It is not a magnet every day.')}
                ${metric('Call wall', formatMoney(company.option.callWall), 'High call OI can act as resistance until price proves otherwise.')}
                ${metric('Put wall', formatMoney(company.option.putWall), 'High put OI can act as support until it breaks.')}
                ${metric('Implied volatility', `${company.option.iv}%`, 'Higher IV means expensive options. Buyers need faster movement to overcome premium decay.')}
                ${metric('Theta warning', 'Time cost', 'If price does not move quickly enough, option premium can decay even when direction is not very wrong.')}
            </div>
        `
    };

    return (pages[pageId] || pages.snapshot)();
}

function renderSimulator() {
    const module = getModule(app.activeModuleId);
    const profile = activeProfile();
    const sim = profile.sim;
    const selected = COMPANIES[app.selectedSymbol] || COMPANIES[DEFAULT_SYMBOL];
    const quote = getQuote(selected.symbol);
    const portfolio = computePortfolio(sim);
    const worksheet = getWorksheet(profile, selected.symbol);
    const researchReady = worksheet.thesis && worksheet.risk;

    return `
        <div class="page-heading">
            <div>
                <h2>Live Market Simulator</h2>
                <p>Paper trading desk with a moving market, simulated news, watchlist, order ticket, stops, journal, and portfolio P&L. The learner practices decisions before opening a real trading platform.</p>
            </div>
            <div class="market-controls">
                <span class="summary-pill"><i data-lucide="clock"></i>${formatMarketTime(sim.tick)}</span>
                <button class="tool-button ${sim.running ? '' : 'primary'}" type="button" data-action="${sim.running ? 'pauseMarket' : 'startMarket'}">
                    <i data-lucide="${sim.running ? 'pause' : 'play'}"></i>
                    <span>${sim.running ? 'Pause' : 'Start Market'}</span>
                </button>
                <button class="tool-button" type="button" data-action="nextTick">
                    <i data-lucide="skip-forward"></i>
                    <span>Next Tick</span>
                </button>
                <button class="tool-button" type="button" data-action="resetSim">
                    <i data-lucide="rotate-ccw"></i>
                    <span>Reset</span>
                </button>
            </div>
        </div>

        <div class="grid-3" style="margin-bottom:14px">
            ${summaryPanel('Portfolio value', formatMoney(portfolio.value), portfolio.pnl >= 0 ? 'positive' : 'negative', `${formatSigned(portfolio.pnl)} total P&L`)}
            ${summaryPanel('Cash', formatMoney(sim.cash), '', 'Virtual capital only')}
            ${summaryPanel('Discipline', `${portfolio.discipline}%`, portfolio.discipline >= 70 ? 'positive' : 'negative', 'Stops, notes, and planned trades')}
        </div>

        <div class="sim-grid">
            <aside class="panel">
                <div class="panel-title">
                    <h2>Watchlist</h2>
                    <span class="status-pill ${sim.running ? 'green' : 'amber'}">${sim.running ? 'Live' : 'Paused'}</span>
                </div>
                <table class="quote-table">
                    <thead>
                        <tr><th>Stock</th><th>Price</th><th>Chg</th></tr>
                    </thead>
                    <tbody>
                        ${Object.values(COMPANIES).map(company => {
                            const item = getQuote(company.symbol);
                            return `
                                <tr data-symbol="${company.symbol}" class="${company.symbol === selected.symbol ? 'is-active' : ''}">
                                    <td><strong>${company.symbol}</strong><br><span>${escapeHTML(company.sector)}</span></td>
                                    <td>${formatMoney(item.price)}</td>
                                    <td class="${item.change >= 0 ? 'positive' : 'negative'}">${formatSigned(item.changePct)}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </aside>

            <section class="panel">
                <div class="panel-title">
                    <h2>${selected.symbol} - ${escapeHTML(selected.name)}</h2>
                    <span class="status-pill ${quote.change >= 0 ? 'green' : 'red'}">${formatSigned(quote.changePct)}%</span>
                </div>
                <div class="chart-wrap">
                    <canvas id="marketChart" aria-label="Simulated price chart"></canvas>
                </div>
                <div class="grid-3" style="margin-top:14px">
                    ${miniMetric('Support', formatMoney(selected.support))}
                    ${miniMetric('Resistance', formatMoney(selected.resistance))}
                    ${miniMetric('Volume', selected.volumeNote)}
                </div>
            </section>

            <aside class="panel">
                <div class="panel-title">
                    <h2>Order ticket</h2>
                    <span class="summary-pill">${selected.symbol} ${formatMoney(quote.price)}</span>
                </div>
                ${!researchReady ? `
                    <div class="explanation" style="margin-bottom:12px">Training rule: write a research thesis and risk note before placing a paper order. You can still use Guest Mode for testing.</div>
                ` : ''}
                <div class="field-grid">
                    <div class="ticket-grid">
                        <label class="field">
                            <span>Side</span>
                            <select id="ticketSide">
                                <option>Buy</option>
                                <option>Sell</option>
                            </select>
                        </label>
                        <label class="field">
                            <span>Order</span>
                            <select id="ticketType">
                                <option>Market</option>
                                <option>Limit</option>
                            </select>
                        </label>
                        <label class="field">
                            <span>Qty</span>
                            <input id="ticketQty" type="number" min="1" step="1" value="10">
                        </label>
                    </div>
                    <div class="ticket-grid">
                        <label class="field">
                            <span>Limit price</span>
                            <input id="ticketLimit" type="number" min="1" step="0.05" value="${round(quote.price)}">
                        </label>
                        <label class="field">
                            <span>Stop loss</span>
                            <input id="ticketStop" type="number" min="1" step="0.05" value="${worksheet.stop || round(selected.support * 0.97)}">
                        </label>
                    </div>
                    <label class="field">
                        <span>Trade note</span>
                        <textarea id="tradeNote" placeholder="Why this trade, what proves it wrong, and what emotion to avoid.">${escapeHTML(worksheet.thesis || '')}</textarea>
                    </label>
                    <div class="action-row">
                        <button class="tool-button primary" type="button" data-action="placeOrder">
                            <i data-lucide="send"></i>
                            <span>Place Paper Order</span>
                        </button>
                        <button class="tool-button" type="button" data-action="closeAll">
                            <i data-lucide="x-circle"></i>
                            <span>Close All</span>
                        </button>
                    </div>
                </div>
            </aside>
        </div>

        <div class="grid-2" style="margin-top:14px">
            <section class="panel">
                <div class="panel-title">
                    <h2>Positions</h2>
                    <span class="summary-pill">${Object.keys(sim.positions).filter(symbol => sim.positions[symbol].qty > 0).length} open</span>
                </div>
                ${renderPositions(sim)}
            </section>
            <section class="panel">
                <div class="panel-title">
                    <h2>Market news and journal</h2>
                    <span class="summary-pill">${module.title}</span>
                </div>
                <div class="news-feed">
                    ${renderFeed(sim)}
                </div>
            </section>
        </div>

        <div class="panel" style="margin-top:14px">
            <div class="panel-title">
                <h2>Assignment progress</h2>
                <span class="status-pill ${portfolio.discipline >= 70 ? 'green' : 'amber'}">Training score</span>
            </div>
            <div class="grid-3">
                ${assignmentStep('Pass chapter test', getTestScore(getTestState(profile, module.id), getQuestions()) >= 70)}
                ${assignmentStep('Save research thesis', Boolean(researchReady))}
                ${assignmentStep('Place planned paper trade', sim.orders.some(order => order.status === 'executed' && order.note && order.stop))}
            </div>
        </div>
    `;
}

function selectAnswer(index) {
    const profile = activeProfile();
    const test = getTestState(profile, app.activeModuleId);
    test.answers[app.activeQuestionIndex] = index;
    saveSoon();
    render();
}

function submitAnswer() {
    const profile = activeProfile();
    const test = getTestState(profile, app.activeModuleId);
    if (test.answers[app.activeQuestionIndex] == null) return;
    test.submitted[app.activeQuestionIndex] = true;
    stampPractice(profile);
    saveSoon();
    render();
}

function resetTest() {
    const profile = activeProfile();
    profile.tests[app.activeModuleId] = { answers: {}, submitted: {} };
    app.activeQuestionIndex = 0;
    saveSoon();
    render();
    showToast('Test reset for this module.');
}

window.investingLabJumpQuestion = function jumpQuestion(index) {
    app.activeQuestionIndex = index;
    render();
};

function saveWorksheet() {
    const profile = activeProfile();
    const company = COMPANIES[app.selectedCompany] || COMPANIES[DEFAULT_SYMBOL];
    profile.research.worksheets[company.symbol] = readWorksheetForm();
    stampPractice(profile);
    saveSoon();
    render();
    showToast('Research saved. Now apply it in the simulator.');
}

async function requestAIFeedback() {
    const profile = activeProfile();
    const company = COMPANIES[app.selectedCompany] || COMPANIES[DEFAULT_SYMBOL];
    const worksheet = readWorksheetForm();
    profile.research.worksheets[company.symbol] = worksheet;
    profile.research.aiFeedback[company.symbol] = { source: 'loading', feedback: 'Coach is reviewing your interpretation...' };
    render();

    try {
        const response = await fetchJson('/api/investing-lab/ai-feedback', {
            method: 'POST',
            body: JSON.stringify({
                profileId: app.profileId,
                moduleId: app.activeModuleId,
                prompt: ASSIGNMENTS[app.activeModuleId].prompt,
                answer: [
                    `Decision: ${worksheet.decision}`,
                    `Thesis: ${worksheet.thesis}`,
                    `Risk: ${worksheet.risk}`,
                    `Entry: ${worksheet.entry || 'not set'}, stop: ${worksheet.stop || 'not set'}, target: ${worksheet.target || 'not set'}, confidence: ${worksheet.confidence}%`
                ].join('\n'),
                context: {
                    module: getModule(app.activeModuleId).title,
                    company: company.name,
                    metrics: pickCompanyMetrics(company),
                    researchPage: app.selectedResearchPage
                }
            })
        });

        profile.research.aiFeedback[company.symbol] = {
            source: response.source || 'ai',
            feedback: response.feedback || 'No feedback returned.'
        };
        stampPractice(profile);
        saveSoon();
        render();
    } catch (error) {
        profile.research.aiFeedback[company.symbol] = {
            source: 'rule-based',
            feedback: localCoachFeedback(worksheet, company)
        };
        saveSoon();
        render();
    }
}

function sendToSim() {
    saveWorksheet();
    const profile = activeProfile();
    profile.sim.selectedSymbol = app.selectedCompany;
    app.selectedSymbol = app.selectedCompany;
    app.view = 'simulator';
    profile.activeView = 'simulator';
    saveSoon();
    render();
}

function startMarket() {
    const profile = activeProfile();
    profile.sim.running = true;
    clearInterval(app.marketTimer);
    app.marketTimer = setInterval(() => {
        const current = activeProfile();
        if (!current || !current.sim.running) {
            pauseMarket();
            return;
        }
        advanceMarket();
        if (app.view === 'simulator') render();
    }, 2300);
    saveSoon();
    render();
}

function pauseMarket() {
    const profile = activeProfile();
    if (profile) profile.sim.running = false;
    clearInterval(app.marketTimer);
    app.marketTimer = null;
    saveSoon();
    render();
}

function advanceMarket() {
    const profile = activeProfile();
    if (!profile) return;
    const sim = profile.sim;
    sim.tick += 1;

    Object.values(COMPANIES).forEach(company => {
        const history = sim.histories[company.symbol];
        const last = history[history.length - 1].price;
        const event = MARKET_EVENTS.find(item => item.tick === sim.tick && item.symbol === company.symbol);
        const drift = Math.sin((sim.tick + company.seed) / 4.5) * company.volatility * 0.24;
        const noise = (pseudoRandom(sim.tick, company.seed) - 0.48) * company.volatility;
        const qualityBias = company.profitGrowth > 15 && company.debtEquity < 0.8 ? 0.035 : company.debtEquity > 1.2 ? -0.035 : 0;
        const impact = event ? event.impact : 0;
        const nextPrice = Math.max(5, last * (1 + (drift + noise + qualityBias + impact) / 100));
        history.push({ tick: sim.tick, price: round(nextPrice) });
        if (history.length > 90) history.shift();

        if (event && !sim.feed.some(item => item.tick === event.tick && item.symbol === event.symbol)) {
            sim.feed.unshift({
                tick: event.tick,
                symbol: event.symbol,
                headline: event.headline,
                lesson: event.lesson,
                time: formatMarketTime(sim.tick)
            });
        }
    });

    processPendingOrders(sim);
    processStops(sim);
    stampPractice(profile);
    saveSoon();
}

function placeOrderFromTicket() {
    const profile = activeProfile();
    const sim = profile.sim;
    const symbol = app.selectedSymbol;
    const side = (document.getElementById('ticketSide').value || 'Buy').toLowerCase();
    const type = (document.getElementById('ticketType').value || 'Market').toLowerCase();
    const qty = Math.floor(Number(document.getElementById('ticketQty').value));
    const limit = Number(document.getElementById('ticketLimit').value);
    const stop = Number(document.getElementById('ticketStop').value);
    const note = document.getElementById('tradeNote').value.trim();
    const quote = getQuote(symbol);

    if (!Number.isFinite(qty) || qty <= 0) {
        showToast('Enter a valid quantity.');
        return;
    }
    if (!note) {
        showToast('Write a trade note first. The lab trains decisions, not clicks.');
        return;
    }
    if (side === 'buy' && (!Number.isFinite(stop) || stop <= 0 || stop >= quote.price)) {
        showToast('For a long trade, stop loss must be below current price.');
        return;
    }

    const order = {
        id: `ORD-${Date.now().toString(36)}`,
        symbol,
        side,
        type,
        qty,
        limit: Number.isFinite(limit) ? round(limit) : null,
        stop: Number.isFinite(stop) ? round(stop) : null,
        note,
        tick: sim.tick,
        time: formatMarketTime(sim.tick),
        status: 'pending'
    };

    const executable = type === 'market' || (side === 'buy' ? quote.price <= order.limit : quote.price >= order.limit);
    if (executable) {
        const ok = executeOrder(sim, order, quote.price);
        if (!ok) return;
    } else {
        sim.orders.unshift(order);
        showToast('Limit order placed. It will execute only if price reaches your limit.');
    }

    sim.journal.unshift({ time: order.time, symbol, note, side, qty });
    stampPractice(profile);
    saveSoon();
    render();
}

function executeOrder(sim, order, price) {
    const value = round(price * order.qty);
    const position = sim.positions[order.symbol] || { qty: 0, avg: 0, realized: 0, stop: null };

    if (order.side === 'buy') {
        if (sim.cash < value) {
            showToast('Not enough virtual cash for this order.');
            return false;
        }
        position.avg = round(((position.avg * position.qty) + value) / (position.qty + order.qty));
        position.qty += order.qty;
        position.stop = order.stop || position.stop;
        sim.cash = round(sim.cash - value);
    } else {
        if (position.qty < order.qty) {
            showToast('You cannot sell more shares than the simulator position holds.');
            return false;
        }
        position.qty -= order.qty;
        position.realized = round((position.realized || 0) + ((price - position.avg) * order.qty));
        sim.cash = round(sim.cash + value);
        if (position.qty === 0) {
            position.avg = 0;
            position.stop = null;
        }
    }

    sim.positions[order.symbol] = position;
    order.status = 'executed';
    order.executionPrice = round(price);
    order.executionTime = formatMarketTime(sim.tick);
    if (!sim.orders.includes(order)) sim.orders.unshift(order);
    showToast(`${order.side === 'buy' ? 'Bought' : 'Sold'} ${order.qty} ${order.symbol} at ${formatMoney(price)}.`);
    return true;
}

function processPendingOrders(sim) {
    sim.orders
        .filter(order => order.status === 'pending')
        .forEach(order => {
            const quote = getQuote(order.symbol);
            const executable = order.side === 'buy' ? quote.price <= order.limit : quote.price >= order.limit;
            if (executable) executeOrder(sim, order, quote.price);
        });
}

function processStops(sim) {
    Object.entries(sim.positions).forEach(([symbol, position]) => {
        if (!position || position.qty <= 0 || !position.stop) return;
        const quote = getQuote(symbol);
        if (quote.price <= position.stop) {
            executeOrder(sim, {
                id: `STP-${Date.now().toString(36)}`,
                symbol,
                side: 'sell',
                type: 'stop',
                qty: position.qty,
                limit: null,
                stop: position.stop,
                note: 'Automatic simulator stop-loss execution.',
                tick: sim.tick,
                time: formatMarketTime(sim.tick),
                status: 'pending'
            }, quote.price);
        }
    });
}

function resetSim() {
    const profile = activeProfile();
    profile.sim = createSimState();
    app.selectedSymbol = DEFAULT_SYMBOL;
    saveSoon();
    render();
    showToast('Simulator reset with fresh virtual capital.');
}

function closeAllPositions() {
    const profile = activeProfile();
    const sim = profile.sim;
    Object.entries({ ...sim.positions }).forEach(([symbol, position]) => {
        if (position.qty > 0) {
            executeOrder(sim, {
                id: `CLS-${Date.now().toString(36)}-${symbol}`,
                symbol,
                side: 'sell',
                type: 'market',
                qty: position.qty,
                limit: null,
                stop: null,
                note: 'Manual close all positions.',
                tick: sim.tick,
                time: formatMarketTime(sim.tick),
                status: 'pending'
            }, getQuote(symbol).price);
        }
    });
    saveSoon();
    render();
}

function readWorksheetForm() {
    return {
        decision: document.getElementById('decisionInput').value,
        thesis: document.getElementById('thesisInput').value.trim(),
        risk: document.getElementById('riskInput').value.trim(),
        entry: numberOrBlank(document.getElementById('entryInput').value),
        stop: numberOrBlank(document.getElementById('stopInput').value),
        target: numberOrBlank(document.getElementById('targetInput').value),
        confidence: Number(document.getElementById('confidenceInput').value) || 50,
        updatedAt: new Date().toISOString()
    };
}

function getWorksheet(profile, symbol) {
    const existing = profile.research.worksheets[symbol];
    if (existing) return existing;
    const company = COMPANIES[symbol] || COMPANIES[DEFAULT_SYMBOL];
    return {
        decision: 'Wait',
        thesis: '',
        risk: '',
        entry: '',
        stop: '',
        target: '',
        confidence: company.debtEquity > 1 ? 35 : 55
    };
}

function getTestState(profile, moduleId) {
    if (!profile.tests[moduleId]) profile.tests[moduleId] = { answers: {}, submitted: {} };
    if (!isObject(profile.tests[moduleId].answers)) profile.tests[moduleId].answers = {};
    if (!isObject(profile.tests[moduleId].submitted)) profile.tests[moduleId].submitted = {};
    return profile.tests[moduleId];
}

function getTestScore(test, questions) {
    const submitted = Object.keys(test.submitted || {});
    if (!submitted.length) return 0;
    const correct = submitted.filter(index => test.answers[index] === questions[index].answer).length;
    return Math.round((correct / questions.length) * 100);
}

function getQuestions() {
    return QUESTION_BANK[app.activeModuleId] || QUESTION_BANK.m1;
}

function getModule(id) {
    return MODULES.find(module => module.id === id) || MODULES[0];
}

function firstUnlockedModule() {
    return MODULES.find(isModuleUnlocked) || MODULES[0];
}

function isModuleUnlocked(module) {
    if (!module) return false;
    if (app.guest) return true;
    const completed = getCompletedVideos(activeLearnProfile()).length;
    return completed >= module.unlockAt;
}

function getCompletedVideos(profile) {
    const progress = profile && profile.progress;
    return Array.isArray(progress && progress.completedVideos) ? progress.completedVideos : [];
}

function totalCourseLessons() {
    return 34;
}

function computeStats(profile) {
    const questionTotals = MODULES.flatMap(module => QUESTION_BANK[module.id] || []);
    let correct = 0;
    let submitted = 0;
    MODULES.forEach(module => {
        const test = getTestState(profile, module.id);
        const questions = QUESTION_BANK[module.id] || [];
        Object.keys(test.submitted).forEach(index => {
            submitted += 1;
            if (test.answers[index] === questions[index].answer) correct += 1;
        });
    });

    const worksheets = Object.values(profile.research.worksheets || {}).filter(item => item.thesis && item.risk).length;
    const aiReviews = Object.values(profile.research.aiFeedback || {}).filter(item => item.feedback).length;
    const trades = profile.sim.orders.filter(order => order.status === 'executed').length;
    const plannedTrades = profile.sim.orders.filter(order => order.status === 'executed' && order.note && (order.stop || order.side === 'sell')).length;
    const testsPassed = MODULES.filter(module => getTestScore(getTestState(profile, module.id), QUESTION_BANK[module.id]) >= 70).length;
    const testScore = questionTotals.length ? Math.round((correct / questionTotals.length) * 100) : 0;
    const discipline = trades ? Math.round((plannedTrades / trades) * 100) : 0;
    const mastery = Math.min(100, Math.round(
        (testsPassed / MODULES.length) * 34
        + (worksheets / MODULES.length) * 28
        + Math.min(trades, 8) / 8 * 24
        + Math.min(aiReviews, 4) / 4 * 14
    ));
    const xp = correct * 10 + worksheets * 60 + aiReviews * 35 + trades * 22 + plannedTrades * 12;

    return { correct, submitted, testScore, worksheets, aiReviews, trades, plannedTrades, discipline, mastery, xp };
}

function computePortfolio(sim) {
    let value = sim.cash;
    let unrealized = 0;
    let realized = 0;
    Object.entries(sim.positions).forEach(([symbol, position]) => {
        if (!position) return;
        const quote = getQuote(symbol);
        value += position.qty * quote.price;
        unrealized += position.qty * (quote.price - position.avg);
        realized += position.realized || 0;
    });

    const pnl = round(value - sim.initialCash);
    const executed = sim.orders.filter(order => order.status === 'executed');
    const planned = executed.filter(order => order.note && (order.stop || order.side === 'sell'));
    const discipline = executed.length ? Math.round((planned.length / executed.length) * 100) : 0;
    return { value: round(value), pnl, unrealized: round(unrealized), realized: round(realized), discipline };
}

function getQuote(symbol) {
    const profile = activeProfile();
    const company = COMPANIES[symbol] || COMPANIES[DEFAULT_SYMBOL];
    const sim = profile ? profile.sim : createSimState();
    const history = sim.histories[symbol] || seedHistory(company);
    const first = history[0].price;
    const latest = history[history.length - 1].price;
    const previous = history[Math.max(0, history.length - 2)].price;
    return {
        price: round(latest),
        change: round(latest - previous),
        changePct: round(((latest - first) / first) * 100)
    };
}

function renderPositions(sim) {
    const rows = Object.entries(sim.positions)
        .filter(([, position]) => position && position.qty > 0)
        .map(([symbol, position]) => {
            const quote = getQuote(symbol);
            const pnl = round((quote.price - position.avg) * position.qty);
            return `
                <tr>
                    <td><strong>${symbol}</strong><br><span>Stop ${position.stop ? formatMoney(position.stop) : 'not set'}</span></td>
                    <td>${position.qty}</td>
                    <td>${formatMoney(position.avg)}</td>
                    <td>${formatMoney(quote.price)}</td>
                    <td class="${pnl >= 0 ? 'positive' : 'negative'}">${formatSigned(pnl)}</td>
                </tr>
            `;
        });

    if (!rows.length) {
        return '<div class="empty-state" style="min-height:180px"><div><h2>No open positions</h2><p>Research a stock, write the thesis, and place a paper order with a stop loss.</p></div></div>';
    }

    return `
        <table class="position-table">
            <thead><tr><th>Stock</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&L</th></tr></thead>
            <tbody>${rows.join('')}</tbody>
        </table>
    `;
}

function renderFeed(sim) {
    const feed = [
        ...sim.feed,
        ...sim.orders.slice(0, 8).map(order => ({
            time: order.executionTime || order.time,
            symbol: order.symbol,
            headline: `${order.status} ${order.side.toUpperCase()} ${order.qty} ${order.symbol}`,
            lesson: order.note || `Order type: ${order.type}`
        }))
    ].slice(0, 10);

    if (!feed.length) {
        return '<div class="news-item"><strong>No events yet</strong><p>Start the market or step through ticks to receive simulated news and order fills.</p></div>';
    }

    return feed.map(item => `
        <div class="news-item">
            <strong>${escapeHTML(item.time || '09:15')} | ${escapeHTML(item.symbol)} - ${escapeHTML(item.headline)}</strong>
            <p>${escapeHTML(item.lesson)}</p>
        </div>
    `).join('');
}

function renderRewards() {
    const profile = activeProfile();
    const stats = computeStats(profile);
    const badges = [
        { title: 'Exam Starter', text: 'Answer 10 test questions.', earned: stats.submitted >= 10 },
        { title: 'Research Analyst', text: 'Save 3 research worksheets.', earned: stats.worksheets >= 3 },
        { title: 'Risk First', text: 'Execute 3 planned trades with stops or notes.', earned: stats.plannedTrades >= 3 },
        { title: 'AI Reviewed', text: 'Get 2 coach reviews.', earned: stats.aiReviews >= 2 },
        { title: 'Simulator Ready', text: 'Reach 70 percent discipline.', earned: stats.discipline >= 70 && stats.trades >= 3 },
        { title: 'Course Linked', text: 'Unlock modules through learn-investing progress.', earned: app.guest || MODULES.filter(isModuleUnlocked).length >= 3 }
    ];

    return `
        <section class="panel" style="margin-top:14px">
            <div class="panel-title">
                <h2>Rewards and habit loops</h2>
                <span class="summary-pill">${badges.filter(badge => badge.earned).length}/${badges.length} earned</span>
            </div>
            <div class="badge-grid">
                ${badges.map(badge => `
                    <div class="badge ${badge.earned ? 'is-earned' : ''}">
                        <strong>${escapeHTML(badge.title)}</strong>
                        <span>${escapeHTML(badge.text)}</span>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

function drawMarketChart() {
    const canvas = document.getElementById('marketChart');
    if (!canvas) return;

    const profile = activeProfile();
    if (!profile) return;
    const sim = profile.sim;
    const symbol = app.selectedSymbol;
    const company = COMPANIES[symbol] || COMPANIES[DEFAULT_SYMBOL];
    const history = sim.histories[symbol] || seedHistory(company);
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(220, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext('2d');
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { left: 52, right: 18, top: 24, bottom: 34 };
    const prices = history.map(point => point.price);
    prices.push(company.support, company.resistance);
    const min = Math.min(...prices) * 0.992;
    const max = Math.max(...prices) * 1.008;
    const xFor = index => pad.left + (index / Math.max(1, history.length - 1)) * (width - pad.left - pad.right);
    const yFor = price => pad.top + (max - price) / (max - min) * (height - pad.top - pad.bottom);

    ctx.strokeStyle = '#e6ebf2';
    ctx.lineWidth = 1;
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#8491a3';
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + i * (height - pad.top - pad.bottom) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        const price = max - i * (max - min) / 4;
        ctx.fillText(formatMoney(price), 8, y + 4);
    }

    drawLevel(ctx, yFor(company.support), width, pad, '#12805c', `Support ${formatMoney(company.support)}`);
    drawLevel(ctx, yFor(company.resistance), width, pad, '#b7791f', `Resistance ${formatMoney(company.resistance)}`);

    ctx.beginPath();
    history.forEach((point, index) => {
        const x = xFor(index);
        const y = yFor(point.price);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    const first = history[0].price;
    const latest = history[history.length - 1].price;
    ctx.strokeStyle = latest >= first ? '#12805c' : '#b42318';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    const lastX = xFor(history.length - 1);
    const lastY = yFor(latest);
    ctx.fillStyle = latest >= first ? '#12805c' : '#b42318';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(`${symbol} ${formatMoney(latest)}`, Math.max(pad.left, lastX - 96), Math.max(16, lastY - 10));
}

function drawLevel(ctx, y, width, pad, color, label) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(label, pad.left + 8, y - 6);
    ctx.restore();
}

function saveSoon() {
    const profile = activeProfile();
    if (profile) {
        profile.activeView = app.view;
        profile.activeModuleId = app.activeModuleId;
        if (profile.research) {
            profile.research.selectedCompany = app.selectedCompany;
            profile.research.selectedPage = app.selectedResearchPage;
        }
        if (profile.sim) profile.sim.selectedSymbol = app.selectedSymbol;
    }

    if (app.guest || !app.profileId) {
        localStorage.setItem('investingLabProfiles', JSON.stringify(app.labState.profiles));
        setSaveStatus('Guest sandbox');
        return;
    }

    clearTimeout(app.saveTimer);
    setSaveStatus('Saving...');
    app.saveTimer = setTimeout(saveNow, 450);
}

async function saveNow() {
    if (app.guest || !app.profileId) return;
    app.isSaving = true;
    try {
        localStorage.setItem('investingLabProfiles', JSON.stringify(app.labState.profiles));
        const response = await fetchJson('/api/investing-lab/state', {
            method: 'POST',
            body: JSON.stringify(app.labState)
        });
        app.labState = normalizeLabState(response.state || app.labState);
        setSaveStatus('Saved to MongoDB');
    } catch (error) {
        console.warn('Investing lab save failed:', error);
        setSaveStatus('Saved locally');
    } finally {
        app.isSaving = false;
    }
}

function setSaveStatus(text) {
    const target = document.getElementById('saveStatus');
    if (target) target.textContent = text;
}

function stampPractice(profile) {
    const today = new Date().toISOString().slice(0, 10);
    if (!profile.practiceDays.includes(today)) {
        profile.practiceDays.push(today);
        if (profile.practiceDays.length > 120) profile.practiceDays.shift();
    }
}

function metric(label, value, help) {
    return `
        <div class="metric-row">
            <span>${escapeHTML(label)}</span>
            <strong>${escapeHTML(String(value))}</strong>
            <p>${escapeHTML(help)}</p>
        </div>
    `;
}

function miniMetric(label, value) {
    return `
        <div class="soft-panel panel">
            <span class="label">${escapeHTML(label)}</span>
            <strong>${escapeHTML(String(value))}</strong>
        </div>
    `;
}

function summaryPanel(label, value, tone, caption) {
    return `
        <div class="panel">
            <span class="label">${escapeHTML(label)}</span>
            <h2 class="${tone || ''}" style="margin:6px 0 4px">${escapeHTML(String(value))}</h2>
            <p style="margin:0;color:var(--muted);font-size:.88rem">${escapeHTML(caption)}</p>
        </div>
    `;
}

function assignmentStep(label, done) {
    return `
        <div class="soft-panel panel">
            <div class="mini-row">
                <strong>${escapeHTML(label)}</strong>
                <i data-lucide="${done ? 'check-circle-2' : 'circle'}"></i>
            </div>
            <p style="margin:8px 0 0;color:var(--muted);line-height:1.45">${done ? 'Completed for this module.' : 'Pending. Finish this before treating the simulator result as valid practice.'}</p>
        </div>
    `;
}

function statPill(icon, text) {
    return `<span class="stat-pill"><i data-lucide="${icon}"></i>${escapeHTML(text)}</span>`;
}

function pickCompanyMetrics(company) {
    return {
        pe: company.pe,
        roe: company.roe,
        debtEquity: company.debtEquity,
        revenueGrowth: company.revenueGrowth,
        profitGrowth: company.profitGrowth,
        operatingMargin: company.operatingMargin,
        cashFlow: company.cashFlow,
        support: company.support,
        resistance: company.resistance,
        pcr: company.option.pcr,
        callWall: company.option.callWall,
        putWall: company.option.putWall
    };
}

function qualityRead(company) {
    if (company.debtEquity > 1.2 || company.profitGrowth < 0 || String(company.cashFlow).startsWith('-')) return 'Risky quality';
    if (company.roe > 18 && company.debtEquity < 0.5 && company.profitGrowth > 12) return 'High quality';
    return 'Mixed quality';
}

function localCoachFeedback(worksheet, company) {
    const lines = ['Rule-based coach feedback:'];
    if ((worksheet.thesis || '').length < 60) lines.push('Make the thesis more specific. Mention valuation, growth, debt, cash flow, and price level.');
    else lines.push('Good: the thesis has enough detail to review.');
    if (!(worksheet.risk || '').toLowerCase().includes('stop') && !worksheet.stop) lines.push('Missing: define the stop loss and what proves the idea wrong.');
    if (company.debtEquity > 1.2) lines.push('Important: debt/equity is elevated in this case. A bullish view must explain why leverage risk is acceptable.');
    if (company.pe > 40) lines.push('Valuation check: high P/E needs growth durability, margin stability, and a patient entry.');
    lines.push('Next simulator action: place only a paper order that matches the written entry, stop, and target.');
    return lines.map((line, index) => index === 0 ? line : `- ${line}`).join('\n');
}

function pseudoRandom(a, b) {
    const x = Math.sin((a + 1) * (b + 11) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function formatMarketTime(tick) {
    const minutes = 9 * 60 + 15 + tick * 5;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return `Rs ${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatSigned(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return `${number >= 0 ? '+' : ''}${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function round(value) {
    return Math.round(Number(value) * 100) / 100;
}

function numberOrBlank(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? round(number) : '';
}

function initials(name) {
    return String(name || 'IT')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0].toUpperCase())
        .join('') || 'IT';
}

function readLocalJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
        return null;
    }
}

function escapeHTML(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
    return escapeHTML(value);
}

function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}
