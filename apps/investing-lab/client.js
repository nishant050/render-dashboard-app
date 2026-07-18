const MODULES = [
    {
        id: 'm0',
        course: 'Module 0',
        title: 'How To Use This Lab',
        short: 'Exact practice workflow',
        unlockAt: 0,
        guide: true,
        assignment: 'Understand the lab workflow before starting tests, research, AI feedback, and paper trading.',
        icon: 'map'
    },
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
    m0: [],
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

const CHART_TOOLS = [
    { id: 'levels', label: 'S/R', name: 'Support and resistance lines', priority: 'Essential', help: 'Important buying and selling zones.' },
    { id: 'trend', label: 'Trend', name: 'Trendlines and channels', priority: 'Essential', help: 'Direction and structure of the current move.' },
    { id: 'volume', label: 'Volume', name: 'Volume', priority: 'Essential', help: 'Whether the move has meaningful participation.' },
    { id: 'ema20', label: 'EMA 20', name: '20 EMA', priority: 'Very useful', help: 'Short-term trend.' },
    { id: 'ema50', label: 'EMA 50', name: '50 EMA', priority: 'Very useful', help: 'Medium-term trend.' },
    { id: 'ema200', label: 'EMA 200', name: '200 EMA', priority: 'Very useful', help: 'Long-term trend, using available simulator history.' },
    { id: 'vwap', label: 'VWAP', name: 'VWAP', priority: 'Very useful', help: 'Intraday average price weighted by volume.' },
    { id: 'rsi', label: 'RSI', name: 'RSI', priority: 'Useful', help: 'Momentum and possible exhaustion.' },
    { id: 'atr', label: 'ATR', name: 'ATR', priority: 'Useful', help: 'Normal movement and stop-loss distance.' }
];

const ASSIGNMENTS = {
    m1: {
        focus: 'Execution mechanics',
        prompt: 'Choose the right order type and explain how settlement, liquidity, and stop placement affect the trade.',
        checklist: ['Use a limit order when price matters', 'Avoid illiquid circuit situations', 'Mention settlement or funds availability']
    },
    m0: {
        focus: 'Lab orientation',
        prompt: 'Learn the exact practice loop: watch a lesson, pass tests, research a simulated company, ask the AI coach, then execute only planned paper trades.',
        checklist: ['Use Guest Mode for testing the app', 'Practice one module at a time', 'Never place a simulator order without a written thesis and risk note']
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

const GUIDE_SECTIONS = [
    {
        id: 'topbar',
        icon: 'panel-top',
        title: 'Top Bar',
        section: 'Dashboard, Course, Profile, Guest Mode',
        what: 'Yahan se learner dashboard par ja sakta hai, course khol sakta hai, profile choose kar sakta hai, aur progress sync kar sakta hai.',
        why: 'Trading practice personal hoti hai. Isliye app ko pata hona chahiye ki kis learner ka progress save karna hai aur kab sirf testing karni hai.',
        how: 'Real learner profile tab use karo jab progress save karna ho. Guest Mode tab use karo jab app ko test karna ho without real progress disturb kiye.',
        cta: { label: 'Try Guest Mode', icon: 'shield-check', action: 'turnOnGuestMode' }
    },
    {
        id: 'learner',
        icon: 'user-round-check',
        title: 'Learner Progress Strip',
        section: 'Active learner, mastery, XP, saved status',
        what: 'Yeh strip batati hai kaun sa learner active hai, course se kitna unlock hua hai, mastery score kya hai, aur save status kya hai.',
        why: 'Student ko hamesha clear hona chahiye ki woh kis profile me practice kar raha hai. Warna testing aur real progress mix ho sakta hai.',
        how: 'Agar naam galat dikhe to profile dropdown change karo. Save status dekhkar confirm karo ki progress MongoDB/local sandbox me properly store ho raha hai.'
    },
    {
        id: 'timeline',
        icon: 'route',
        title: 'Module Timeline',
        section: 'Chapter-wise unlock path',
        what: 'Timeline lab ko learn-investing course ke chapter order se connect karti hai. Important topics tab unlock hote hain jab learner ne enough course lessons complete kiye hote hain.',
        why: 'Student ko ek time par ek skill practice karni chahiye. Isse random trading nahi hoti; chapter se direct practice hoti hai.',
        how: 'Module 1 se start karo, phir course progress ke saath next modules unlock karo. Guest Mode me sab modules testing ke liye open rehte hain.'
    },
    {
        id: 'modes',
        icon: 'panel-bottom',
        title: 'Mode Switcher',
        section: 'Tests, Research Drill, Live Simulator',
        what: 'Yeh three-stage practice loop hai: pehle tests, phir research drill, phir simulator execution.',
        why: 'Direct simulator me jump karne se learner guessing karta hai. Is order se woh pehle concept prove karta hai, phir evidence read karta hai, phir trade plan execute karta hai.',
        how: 'Har chapter me flow same rakho: Tests pass karo, Research worksheet save karo, AI feedback lo, phir Simulator me paper trade place karo.',
        cta: { label: 'Start Module 1', icon: 'play', action: 'openTestsMode' }
    },
    {
        id: 'tests',
        icon: 'clipboard-check',
        title: 'Tests Workspace',
        section: 'Q&A, explanations, score gate',
        what: 'Tests learner ko chapter ke core ideas par check karte hain. Har answer ke baad explanation milti hai.',
        why: 'Agar learner basic order type, valuation, risk, ya chart concept galat samajhta hai, to simulator me woh costly mistake repeat karega.',
        how: 'Question submit karo, explanation padho, galat answer ko revise karo. 70 percent ke baad research drill par jao.',
        cta: { label: 'Open Tests', icon: 'clipboard-check', action: 'openTestsMode' }
    },
    {
        id: 'research',
        icon: 'search-check',
        title: 'Research Browser',
        section: 'Simulated websites and worksheet',
        what: 'Research Browser learner ko real investing apps jaise pages practice karata hai: quote, financials, annual report, chart notes, option chain.',
        why: 'Numbers dekhna enough nahi hota. Learner ko samajhna hota hai ki P/E, ROE, debt, cash flow, volume, OI ka decision par kya impact hai.',
        how: 'Page expand karo, numbers read karo, help ? use karo, thesis aur risk note plain language me likho, phir worksheet save karo.',
        cta: { label: 'Open Research Mode', icon: 'search-check', action: 'openResearchMode' }
    },
    {
        id: 'ai',
        icon: 'sparkles',
        title: 'AI Help And Coach',
        section: 'Hinglish explanations and feedback',
        what: 'AI section difficult terms ko Hinglish me explain karta hai aur learner ke thesis/risk note par feedback deta hai.',
        why: 'Market research me confusion normal hai. AI coach learner ko batata hai ki interpretation logical hai ya important evidence miss ho raha hai.',
        how: 'Research page par ? click karo for section help. Worksheet likhne ke baad AI Coach se ask karo: kya thought process sahi hai?'
    },
    {
        id: 'simulator',
        icon: 'activity',
        title: 'Live Simulator',
        section: 'Paper market, chart, order ticket',
        what: 'Simulator broker-app jaisa practice desk hai: live ticks, line/candle chart, tools, quantity, limit price, stop loss, target, and trade note.',
        why: 'Real capital se pehle learner ko execution pressure, price movement, loss planning, and emotional control practice karna chahiye.',
        how: 'Research se idea send karo, chart tools only when needed use karo, max loss calculate karo, note likho, then paper order place karo.',
        cta: { label: 'Open Simulator', icon: 'activity', action: 'openSimulatorMode' }
    },
    {
        id: 'journal',
        icon: 'notebook-tabs',
        title: 'Journal And Review',
        section: 'Orders, notes, discipline',
        what: 'Journal trades, notes, stops, and outcomes ko record karta hai so learner process review kar sake.',
        why: 'Profit alone training nahi hai. Good trader yeh check karta hai ki plan follow hua ya emotion-based trade hua.',
        how: 'Har order ke saath note likho: thesis, invalidation, emotion to avoid. Loss ke baad revenge trade mat karo; review first.'
    },
    {
        id: 'rewards',
        icon: 'trophy',
        title: 'Rewards Loop',
        section: 'XP, badges, mastery',
        what: 'Rewards practice ko measurable banate hain: tests, research worksheets, AI reviews, planned trades, and discipline.',
        why: 'Addicting app ka matlab random dopamine nahi; learner ko right habits ke liye reward milna chahiye.',
        how: 'Badge chase karo only by doing good process: explanations read, worksheet save, stops use, journal maintain.'
    }
];

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
const INITIAL_HISTORY_POINTS = 96;
const MAX_HISTORY_POINTS = 1800;
const DEFAULT_CHART_RANGE = '1D';
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_TICK_MINUTES = 5;
const TRADING_DAY_TICKS = 75;
const CHART_RANGES = [
    { id: '1D', label: '1D', sourceBars: 72, bucket: 1, targetBars: 72 },
    { id: '7D', label: '7D', sourceBars: 280, bucket: 4, targetBars: 70 },
    { id: '1M', label: '1M', sourceBars: 560, bucket: 10, targetBars: 56 },
    { id: '1Y', label: '1Y', sourceBars: 1200, bucket: 24, targetBars: 50 },
    { id: 'ALL', label: 'All', sourceBars: Infinity, bucket: 'auto', targetBars: 64 }
];

const app = {
    learnState: { profiles: {}, currentProfileId: null },
    labState: { profiles: {} },
    profileId: null,
    guest: false,
    view: 'tests',
    activeModuleId: 'm0',
    activeQuestionIndex: 0,
    selectedCompany: DEFAULT_SYMBOL,
    selectedResearchPage: 'snapshot',
    selectedSymbol: DEFAULT_SYMBOL,
    guideSpotId: 'topbar',
    researchExpanded: false,
    researchHelp: {
        open: false,
        loading: false,
        title: '',
        context: null,
        messages: []
    },
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
    document.addEventListener('input', handleLiveInput);
    document.addEventListener('change', handleLiveInput);

    document.addEventListener('click', event => {
        const viewButton = event.target.closest('[data-view]');
        if (viewButton) {
            app.view = viewButton.dataset.view;
            const profile = activeProfile();
            if (profile) profile.activeView = app.view;
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
            const profile = activeProfile();
            if (profile) profile.activeModuleId = moduleId;
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
            captureTicketDraft();
            const symbol = symbolRow.dataset.symbol;
            app.selectedSymbol = symbol;
            activeProfile().sim.selectedSymbol = symbol;
            activeProfile().sim.ticket = null;
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

        const helpButton = event.target.closest('[data-help-topic]');
        if (helpButton) {
            openResearchHelp(helpButton);
            return;
        }

        const guideSpotButton = event.target.closest('[data-guide-spot]');
        if (guideSpotButton) {
            setGuideSpot(guideSpotButton.dataset.guideSpot);
            return;
        }

        const chartRangeButton = event.target.closest('[data-chart-range]');
        if (chartRangeButton) {
            setChartRange(chartRangeButton.dataset.chartRange);
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
        prevGuideSpot: () => stepGuideSpot(-1),
        nextGuideSpot: () => stepGuideSpot(1),
        turnOnGuestMode: () => {
            if (!app.guest) {
                document.getElementById('guestModeButton').click();
            } else {
                showToast('Guest Mode is already on. Real learner progress is safe.');
            }
        },
        openTestsMode: () => openLabMode('m1', 'tests'),
        expandResearch: () => {
            app.researchExpanded = true;
            render();
        },
        closeResearchExpansion: () => {
            app.researchExpanded = false;
            render();
        },
        closeResearchHelp: () => {
            app.researchHelp.open = false;
            render();
        },
        sendResearchHelpQuestion,
        openResearchMode: () => openLabMode('m1', 'research'),
        openSimulatorMode: () => openLabMode('m1', 'simulator'),
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

function setChartRange(rangeId) {
    const profile = activeProfile();
    if (!profile || !profile.sim) return;
    profile.sim.chartRange = getChartRange(rangeId).id;
    document.querySelectorAll('[data-chart-range]').forEach(button => {
        button.classList.toggle('is-active', button.dataset.chartRange === profile.sim.chartRange);
    });
    saveSoon();
    requestAnimationFrame(drawMarketChart);
}

function openLabMode(moduleId, view) {
    const module = getModule(moduleId);
    if (!isModuleUnlocked(module)) {
        showToast('Complete more course lessons or use Guest Mode to test this module.');
        return;
    }

    app.activeModuleId = module.id;
    app.view = view;
    app.activeQuestionIndex = 0;

    const profile = activeProfile();
    if (profile) {
        profile.activeModuleId = app.activeModuleId;
        profile.activeView = app.view;
    }

    saveSoon();
    render();
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
        activeModuleId: 'm0',
        guideExplored: [],
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
        guideExplored: Array.isArray(source.guideExplored) ? source.guideExplored : [],
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
        chartType: 'line',
        chartRange: DEFAULT_CHART_RANGE,
        histories,
        tools: defaultChartTools(),
        toolsVersion: 2,
        ticket: null,
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
        chartType: ['line', 'candles'].includes(source.chartType) ? source.chartType : 'line',
        chartRange: getChartRange(source.chartRange).id,
        histories: isObject(source.histories) ? source.histories : base.histories,
        tools: source.toolsVersion === 2 && isObject(source.tools) ? { ...defaultChartTools(), ...source.tools } : defaultChartTools(),
        toolsVersion: 2,
        ticket: isObject(source.ticket) ? source.ticket : null,
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

function defaultChartTools() {
    return {
        levels: false,
        trend: false,
        volume: false,
        ema20: false,
        ema50: false,
        ema200: false,
        vwap: false,
        rsi: false,
        atr: false
    };
}

function seedHistory(company) {
    const points = [];
    let price = company.price * 0.982;
    for (let i = 0; i < INITIAL_HISTORY_POINTS - 1; i++) {
        const wave = Math.sin((i + company.seed) / 3.2) * company.volatility;
        const noise = (pseudoRandom(i, company.seed) - 0.5) * company.volatility;
        price = Math.max(5, price * (1 + (wave + noise) / 500));
        points.push({ tick: i - (INITIAL_HISTORY_POINTS - 1), price: round(price) });
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
    captureTicketDraft();
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

    if (module.guide) {
        document.getElementById('workspace').innerHTML = renderModuleGuide();
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

function renderPreservingResearchState(options = {}) {
    const snapshot = captureResearchViewState();
    render();
    restoreResearchViewState(snapshot, options);
}

function captureResearchViewState() {
    const active = document.activeElement;
    return {
        windowX: window.scrollX,
        windowY: window.scrollY,
        modalScrollTop: document.querySelector('.research-modal')?.scrollTop || 0,
        helpScrollTop: document.querySelector('.research-help-messages')?.scrollTop || 0,
        focusedSelector: getStableFocusSelector(active),
        focusedValue: active && 'value' in active ? active.value : null,
        focusedSelectionStart: active && typeof active.selectionStart === 'number' ? active.selectionStart : null,
        focusedSelectionEnd: active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
}

function restoreResearchViewState(snapshot, options = {}) {
    requestAnimationFrame(() => {
        const modal = document.querySelector('.research-modal');
        if (modal) modal.scrollTop = snapshot.modalScrollTop;

        const helpMessages = document.querySelector('.research-help-messages');
        if (helpMessages) {
            helpMessages.scrollTop = options.scrollHelpToBottom ? helpMessages.scrollHeight : snapshot.helpScrollTop;
        }

        window.scrollTo(snapshot.windowX, snapshot.windowY);

        const focusSelector = options.focusSelector || snapshot.focusedSelector;
        if (focusSelector) {
            const target = document.querySelector(focusSelector);
            if (target && typeof target.focus === 'function') {
                target.focus({ preventScroll: true });
                if (!options.focusSelector && snapshot.focusedValue != null && 'value' in target && target.value !== snapshot.focusedValue) {
                    target.value = snapshot.focusedValue;
                }
                if (!options.focusSelector && typeof target.setSelectionRange === 'function' && snapshot.focusedSelectionStart != null) {
                    const end = snapshot.focusedSelectionEnd == null ? snapshot.focusedSelectionStart : snapshot.focusedSelectionEnd;
                    target.setSelectionRange(snapshot.focusedSelectionStart, end);
                }
            }
        }
    });
}

function getStableFocusSelector(element) {
    if (!element || !element.matches) return '';
    if (element.matches('[data-help-question]')) return '[data-help-question]';
    if (element.matches('[data-worksheet-field]')) return `[data-worksheet-field="${element.dataset.worksheetField}"]`;
    if (element.id) return `#${CSS.escape(element.id)}`;
    return '';
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

function setGuideSpot(id) {
    const spot = getGuideSpot(id);
    app.guideSpotId = spot.id;
    markGuideSpotExplored(spot.id);
    saveSoon();
    render();
}

function stepGuideSpot(direction) {
    const currentIndex = Math.max(0, GUIDE_SECTIONS.findIndex(spot => spot.id === app.guideSpotId));
    const nextIndex = (currentIndex + direction + GUIDE_SECTIONS.length) % GUIDE_SECTIONS.length;
    setGuideSpot(GUIDE_SECTIONS[nextIndex].id);
}

function getGuideSpot(id) {
    return GUIDE_SECTIONS.find(spot => spot.id === id) || GUIDE_SECTIONS[0];
}

function getGuideExploredSet(profile = activeProfile()) {
    return new Set(Array.isArray(profile && profile.guideExplored) ? profile.guideExplored : []);
}

function markGuideSpotExplored(id) {
    const profile = activeProfile();
    if (!profile) return;
    if (!Array.isArray(profile.guideExplored)) profile.guideExplored = [];
    if (!profile.guideExplored.includes(id)) profile.guideExplored.push(id);
}

function renderModuleGuide() {
    const profile = activeProfile();
    const selected = getGuideSpot(app.guideSpotId);
    const exploredSet = getGuideExploredSet(profile);
    const exploredCount = exploredSet.size;
    const selectedIndex = GUIDE_SECTIONS.findIndex(spot => spot.id === selected.id) + 1;
    const done = exploredCount >= GUIDE_SECTIONS.length;
    const loop = [
        'Chapter padho',
        'Tests pass karo',
        'Research numbers interpret karo',
        'AI feedback lo',
        'Simulator me planned paper trade karo',
        'Journal review karo'
    ];

    return `
        <div class="page-heading">
            <div>
                <h2>Module 0: Click The Page Sections</h2>
                <p>Har highlighted section par click karo. Popup batayega yeh kya karta hai, kyun exist karta hai, aur learner ko exactly kaise use karna hai.</p>
            </div>
            <span class="summary-pill"><i data-lucide="${done ? 'check-circle-2' : 'mouse-pointer-click'}"></i>${exploredCount}/${GUIDE_SECTIONS.length} explored</span>
        </div>

        <div class="guide-grid tour-grid">
            <section class="panel guide-main tour-stage">
                <div class="panel-title">
                    <div>
                        <h2>Training lab page map</h2>
                        <p class="panel-subtitle">Click one section at a time. The help popup updates on the right.</p>
                    </div>
                    <span class="status-pill ${done ? 'green' : 'amber'}">Step ${selectedIndex}/${GUIDE_SECTIONS.length}</span>
                </div>
                <div class="tour-progress" aria-hidden="true">
                    <span style="width:${Math.round((exploredCount / GUIDE_SECTIONS.length) * 100)}%"></span>
                </div>
                <div class="tour-screen" aria-label="Clickable investing lab sections">
                    <div class="tour-screen-label">
                        <span>Investing Training Lab</span>
                        <strong>Interactive orientation</strong>
                    </div>
                    ${renderGuideZone(getGuideSpot('topbar'), selected, exploredSet, 'tour-zone-wide')}
                    <div class="tour-row">
                        ${renderGuideZone(getGuideSpot('learner'), selected, exploredSet)}
                        ${renderGuideZone(getGuideSpot('timeline'), selected, exploredSet)}
                        ${renderGuideZone(getGuideSpot('modes'), selected, exploredSet)}
                    </div>
                    <div class="tour-workspace-map">
                        <div class="tour-workspace-title">
                            <span>Workspace</span>
                            <strong>Practice happens here</strong>
                        </div>
                        <div class="tour-tool-grid">
                            ${['tests', 'research', 'ai', 'simulator', 'journal', 'rewards'].map(id => renderGuideZone(getGuideSpot(id), selected, exploredSet)).join('')}
                        </div>
                    </div>
                </div>
            </section>

            <aside class="panel tour-popup" aria-live="polite">
                ${renderGuidePopup(selected, exploredSet)}
            </aside>
        </div>

        <section class="panel tour-loop-panel">
            <div class="panel-title">
                <h2>Exact practice timeline</h2>
                <span class="summary-pill">One clean loop</span>
            </div>
            <div class="tour-loop">
                ${loop.map((item, index) => `
                    <div class="tour-loop-step">
                        <span>${index + 1}</span>
                        <strong>${escapeHTML(item)}</strong>
                    </div>
                `).join('')}
            </div>
            <div class="action-row tour-start-row">
                <button class="tool-button primary" data-action="openTestsMode" type="button">
                    <i data-lucide="play"></i>
                    <span>Start Module 1 Tests</span>
                </button>
                <button class="tool-button" data-action="openResearchMode" type="button">
                    <i data-lucide="search-check"></i>
                    <span>Open Research Drill</span>
                </button>
            </div>
        </section>
    `;
}

function renderGuideZone(spot, selected, exploredSet, extraClass = '') {
    const active = selected.id === spot.id;
    const explored = exploredSet.has(spot.id);
    return `
        <button class="tour-zone ${extraClass} ${active ? 'is-active' : ''} ${explored ? 'is-explored' : ''}" type="button" data-guide-spot="${escapeAttr(spot.id)}" aria-pressed="${active ? 'true' : 'false'}">
            <span class="tour-zone-icon"><i data-lucide="${escapeAttr(spot.icon)}"></i></span>
            <span class="tour-zone-copy">
                <strong>${escapeHTML(spot.title)}</strong>
                <small>${escapeHTML(spot.section)}</small>
            </span>
            <span class="tour-zone-status"><i data-lucide="${explored ? 'check-circle-2' : 'circle-help'}"></i></span>
        </button>
    `;
}

function renderGuidePopup(spot, exploredSet) {
    const cta = spot.cta
        ? `<button class="tool-button primary" data-action="${escapeAttr(spot.cta.action)}" type="button"><i data-lucide="${escapeAttr(spot.cta.icon)}"></i><span>${escapeHTML(spot.cta.label)}</span></button>`
        : '';

    return `
        <div class="tour-popup-head">
            <span class="tour-popup-icon"><i data-lucide="${escapeAttr(spot.icon)}"></i></span>
            <div>
                <p class="label">Section popup</p>
                <h2>${escapeHTML(spot.title)}</h2>
                <span>${escapeHTML(spot.section)}</span>
            </div>
        </div>
        <div class="tour-help-stack">
            <div class="tour-help-block">
                <strong>Kya karta hai?</strong>
                <p>${escapeHTML(spot.what)}</p>
            </div>
            <div class="tour-help-block">
                <strong>Kyun exist karta hai?</strong>
                <p>${escapeHTML(spot.why)}</p>
            </div>
            <div class="tour-help-block">
                <strong>Kaise use kare?</strong>
                <p>${escapeHTML(spot.how)}</p>
            </div>
        </div>
        <div class="tour-popup-footer">
            <span class="summary-pill"><i data-lucide="check-circle-2"></i>${exploredSet.size}/${GUIDE_SECTIONS.length} done</span>
            <div class="action-row">
                <button class="tool-button" data-action="prevGuideSpot" type="button">
                    <i data-lucide="arrow-left"></i>
                    <span>Previous</span>
                </button>
                <button class="tool-button" data-action="nextGuideSpot" type="button">
                    <span>Next</span>
                    <i data-lucide="arrow-right"></i>
                </button>
                ${cta}
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
                        <button class="text-button compact" type="button" data-action="expandResearch">
                            <i data-lucide="maximize-2"></i>
                            <span>Expand</span>
                        </button>
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

                ${renderWorksheetPanel(company, worksheet, feedback)}
            </section>
        </div>
        ${app.researchExpanded ? renderResearchExpansion(company) : ''}
        ${!app.researchExpanded ? renderResearchHelpPanel() : ''}
    `;
}

function renderResearchExpansion(company) {
    const page = RESEARCH_PAGES.find(item => item.id === app.selectedResearchPage) || RESEARCH_PAGES[0];
    const profile = activeProfile();
    const worksheet = getWorksheet(profile, company.symbol);
    const feedback = profile.research.aiFeedback[company.symbol];
    return `
        <div class="research-overlay" role="dialog" aria-modal="true" aria-label="${escapeAttr(page.label)} expanded research browser">
            <div class="research-modal">
                <div class="panel-title">
                    <div>
                        <p class="label">research.sim/${company.symbol.toLowerCase()}/${page.id}</p>
                        <h2>${company.symbol} Research Browser</h2>
                    </div>
                    <button class="tool-button" type="button" data-action="closeResearchExpansion">
                        <i data-lucide="x"></i>
                        <span>Close</span>
                    </button>
                </div>
                <div class="expanded-browser-frame">
                    <div class="browser-bar">
                        <span class="browser-dot"></span>
                        <span class="browser-dot"></span>
                        <span class="browser-dot"></span>
                        <span class="browser-url">research.sim/${company.symbol.toLowerCase()}/${page.id}</span>
                        ${helpButton('Research browser', 'Full research browser', 'Use this expanded workspace to read simulated research pages, ask AI for clarification, and complete the worksheet without switching views.', { compact: true })}
                    </div>
                    <div class="tab-row">
                        ${RESEARCH_PAGES.map(item => `
                            <button class="tab-button ${item.id === app.selectedResearchPage ? 'is-active' : ''}" data-page="${item.id}" type="button">
                                <i data-lucide="${item.icon}"></i>
                                <span>${item.label}</span>
                            </button>
                        `).join('')}
                    </div>
                    <div class="expanded-research-layout">
                        <section class="expanded-research-content">
                            ${renderResearchPage(company, page.id, { expanded: true })}
                        </section>
                        ${renderWorksheetPanel(company, worksheet, feedback, { expanded: true })}
                    </div>
                </div>
                ${renderResearchHelpPanel()}
            </div>
        </div>
    `;
}

function renderWorksheetPanel(company, worksheet, feedback, options = {}) {
    return `
        <div class="panel worksheet-panel ${options.expanded ? 'expanded-worksheet' : ''}">
            <div class="panel-title">
                <h2>Student interpretation ${helpButton('Student interpretation', 'Research worksheet', 'This is where the learner converts raw numbers into a decision, risk plan, entry, stop, target, and confidence. The AI Coach reviews this written thinking.')}</h2>
                <span class="status-pill ${worksheet.thesis ? 'green' : 'amber'}">${worksheet.thesis ? 'Saved' : 'Draft'}</span>
            </div>
            <div class="field-grid">
                <label class="field">
                    <span>Decision</span>
                    <select data-worksheet-field="decision">
                        ${selectOptions(['Wait', 'Research more', 'Paper buy', 'Avoid', 'Paper sell'], worksheet.decision || 'Wait')}
                    </select>
                </label>
                <label class="field">
                    <span>Thesis in plain English</span>
                    <textarea data-worksheet-field="thesis" placeholder="Example: Quality is strong, valuation is fair, but I will wait for price near support.">${escapeHTML(worksheet.thesis || '')}</textarea>
                </label>
                <label class="field">
                    <span>Risk and opposite evidence</span>
                    <textarea data-worksheet-field="risk" placeholder="What would prove your idea wrong? What number worries you?">${escapeHTML(worksheet.risk || '')}</textarea>
                </label>
                <div class="ticket-grid">
                    <label class="field">
                        <span>Entry</span>
                        <input data-worksheet-field="entry" type="number" min="1" step="0.05" value="${escapeAttr(worksheet.entry || '')}" placeholder="${company.support}">
                    </label>
                    <label class="field">
                        <span>Stop</span>
                        <input data-worksheet-field="stop" type="number" min="1" step="0.05" value="${escapeAttr(worksheet.stop || '')}" placeholder="${round(company.support * 0.97)}">
                    </label>
                    <label class="field">
                        <span>Target</span>
                        <input data-worksheet-field="target" type="number" min="1" step="0.05" value="${escapeAttr(worksheet.target || '')}" placeholder="${company.resistance}">
                    </label>
                </div>
                <label class="field">
                    <span>Confidence: ${worksheet.confidence || 50}%</span>
                    <input data-worksheet-field="confidence" type="range" min="0" max="100" step="5" value="${worksheet.confidence || 50}">
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
                    <div class="ai-feedback markdown-body">${renderMarkdown(feedback.feedback)}</div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderResearchHelpPanel() {
    if (!app.researchHelp.open) return '';

    return `
        <aside class="research-help-panel" aria-label="AI research help">
            <div class="panel-title">
                <div>
                    <p class="label">AI research help</p>
                    <h2>${escapeHTML(app.researchHelp.title || 'Ask about this section')}</h2>
                </div>
                <button class="icon-button" type="button" data-action="closeResearchHelp" aria-label="Close AI help">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="research-help-messages">
                ${app.researchHelp.messages.map(message => `
                    <div class="help-message ${message.role === 'user' ? 'is-user' : 'is-ai'}">
                        <div class="markdown-body">${renderMarkdown(message.content)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="research-help-input">
                <textarea data-help-question placeholder="Hinglish mein pucho, e.g. resistance ka simple matlab kya hai?"></textarea>
                <button class="tool-button primary" type="button" data-action="sendResearchHelpQuestion" ${app.researchHelp.loading ? 'disabled' : ''}>
                    <i data-lucide="send"></i>
                    <span>Ask</span>
                </button>
            </div>
        </aside>
    `;
}

function renderResearchPage(company, pageId, options = {}) {
    const expandedClass = options.expanded ? ' is-expanded' : '';
    const pages = {
        snapshot: () => `
            <div class="panel-title">
                <h2>${company.symbol} Quote Snapshot ${helpButton('Quote Snapshot', 'Quote Snapshot', 'This page gives the current price, market size, valuation, profitability, debt, and promoter pledge so the learner can form a first business-quality view.')}</h2>
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
                <h2>Financial Statement Practice ${helpButton('Financial Statement Practice', 'Financial Statement Practice', 'This page teaches whether sales, profit, margins, cash flow, and liquidity support the story shown by the stock price.')}</h2>
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
                <h2>Simulated Annual Report Notes ${helpButton('Annual Report Notes', 'Annual Report Notes', 'This page trains the learner to read management commentary, business story, risks, and whether words are supported by measurable results.')}</h2>
                <span class="summary-pill">Management discussion</span>
            </div>
            <div class="list-stack">
                <div class="news-item"><strong>Business story ${helpButton('Business story', 'Business story', company.story)}</strong><p>${escapeHTML(company.story)}</p></div>
                <div class="news-item"><strong>Main risk ${helpButton('Main risk', 'Main risk', company.risk)}</strong><p>${escapeHTML(company.risk)}</p></div>
                <div class="news-item"><strong>What to look for ${helpButton('Annual report checklist', 'What to look for', 'Does management explain growth in numbers, or only in optimistic language? Check margins, cash flow, debt, and capital allocation.')}</strong><p>Does management explain growth in numbers, or only in optimistic language? Check margins, cash flow, debt, and capital allocation.</p></div>
                <div class="news-item"><strong>Interpretation rule ${helpButton('Annual report interpretation rule', 'Interpretation rule', 'A strong report connects strategy to measurable results. A weak report avoids numbers or explains away repeated cash-flow weakness.')}</strong><p>A strong report connects strategy to measurable results. A weak report avoids numbers or explains away repeated cash-flow weakness.</p></div>
            </div>
        `,
        chart: () => `
            <div class="panel-title">
                <h2>Technical Reading Desk ${helpButton('Technical Reading Desk', 'Technical Reading Desk', 'This page helps the learner translate chart structure into timing: support, resistance, trend, and volume confirmation.')}</h2>
                <span class="summary-pill">Timing only</span>
            </div>
            <div class="metric-grid">
                ${metric('Support', formatMoney(company.support), 'Area where demand recently appeared. If it breaks, the trade thesis may be wrong.')}
                ${metric('Resistance', formatMoney(company.resistance), 'Area where supply recently appeared. Breakouts need volume and follow-through.')}
                ${metric('Trend', company.trend, 'Trend tells whether you are trading with or against current market behavior.')}
                ${metric('Volume read', company.volumeNote, 'Volume confirms whether a price move has real participation.')}
            </div>
            ${interpretationGuide('How to interpret this page', [
                'Start with support: this is the area where your long trade thesis becomes testable.',
                'Then mark resistance: this is where profit booking or supply can appear.',
                'Use trend to decide whether you are trading with structure or against it.',
                'Use volume to decide whether a move has real participation or only a weak price push.',
                'Write the entry, stop, and target only after these four pieces agree.'
            ])}
        `,
        options: () => `
            <div class="panel-title">
                <h2>Option Chain Simulator ${helpButton('Option Chain Simulator', 'Option Chain Simulator', 'This page teaches option-chain context: PCR, max pain, call wall, put wall, IV, theta, and strike-wise open interest.')}</h2>
                <span class="summary-pill">Context, not certainty</span>
            </div>
            ${renderOptionChainDesk(company, expandedClass)}
        `
    };

    return (pages[pageId] || pages.snapshot)();
}

function renderOptionChainDesk(company, extraClass = '') {
    const strikes = buildOptionChainRows(company);
    return `
            <div class="option-chain-desk${extraClass}">
                <div class="metric-grid option-summary">
                ${metric('PCR', company.option.pcr, 'Put-call ratio is a sentiment input. Extreme readings need confirmation from price.')}
                ${metric('Max pain', formatMoney(company.option.maxPain), 'The strike where option writers theoretically have least payout. It is not a magnet every day.')}
                ${metric('Call wall', formatMoney(company.option.callWall), 'High call OI can act as resistance until price proves otherwise.')}
                ${metric('Put wall', formatMoney(company.option.putWall), 'High put OI can act as support until it breaks.')}
                ${metric('Implied volatility', `${company.option.iv}%`, 'Higher IV means expensive options. Buyers need faster movement to overcome premium decay.')}
                ${metric('Theta warning', 'Time cost', 'If price does not move quickly enough, option premium can decay even when direction is not very wrong.')}
            </div>
            <div class="table-responsive">
                <div class="panel-title table-title">
                    <h2>Strike table ${helpButton('Option strike table', 'Option strike table', 'This table compares call open interest, put open interest, premiums, and nearby strike levels. The learner should identify possible resistance, support, and premium risk.')}</h2>
                </div>
                <table class="option-chain-table">
                    <thead>
                        <tr>
                            <th>Call OI</th>
                            <th>Call LTP</th>
                            <th>Strike</th>
                            <th>Put LTP</th>
                            <th>Put OI</th>
                            <th>Read</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${strikes.map(row => `
                            <tr class="${row.isAtm ? 'is-atm' : ''}">
                                <td>${row.callOi}</td>
                                <td>${formatMoney(row.callLtp)}</td>
                                <td><strong>${formatMoney(row.strike)}</strong></td>
                                <td>${formatMoney(row.putLtp)}</td>
                                <td>${row.putOi}</td>
                                <td>${escapeHTML(row.read)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="option-read">
                <strong>How to interpret this page ${helpButton('How to interpret option chain', 'How to interpret this page', 'First mark current price, then compare nearby call OI and put OI. Heavy call OI can become resistance, heavy put OI can become support, PCR is sentiment, IV tells premium cost, and theta reminds option buyers that time is leaking.')}</strong>
                <p>First mark the current price, then compare nearby call OI and put OI. Heavy call OI can become resistance, heavy put OI can become support, PCR is sentiment, IV tells premium cost, and theta reminds option buyers that time is leaking.</p>
            </div>
        </div>
    `;
}

function interpretationGuide(title, items) {
    return `
        <div class="interpretation-guide">
            <div class="panel-title">
                <h2>${escapeHTML(title)} ${helpButton(title, title, items.join(' '))}</h2>
            </div>
            <ol>
                ${items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
            </ol>
        </div>
    `;
}

function buildOptionChainRows(company) {
    const step = company.price > 1000 ? 20 : company.price > 400 ? 10 : 5;
    const atm = Math.round(company.price / step) * step;
    return [-3, -2, -1, 0, 1, 2, 3].map(offset => {
        const strike = atm + offset * step;
        const distance = Math.abs(company.price - strike);
        const callWallBoost = Math.abs(strike - company.option.callWall) < step / 2 ? 90 : 0;
        const putWallBoost = Math.abs(strike - company.option.putWall) < step / 2 ? 90 : 0;
        const baseOi = 80 - Math.min(55, Math.round(distance / step) * 11);
        const callOi = Math.max(18, baseOi + callWallBoost + (strike > company.price ? 20 : -8));
        const putOi = Math.max(18, baseOi + putWallBoost + (strike < company.price ? 20 : -8));
        const intrinsicCall = Math.max(0, company.price - strike);
        const intrinsicPut = Math.max(0, strike - company.price);
        const timeValue = Math.max(2, company.option.iv / 8 - Math.abs(offset) * 0.35);
        const isAtm = offset === 0;
        const read = isAtm
            ? 'ATM: watch premium decay and direction.'
            : strike >= company.option.callWall
                ? 'Call supply zone.'
                : strike <= company.option.putWall
                    ? 'Put support zone.'
                    : 'Context strike.';
        return {
            strike,
            callOi: `${callOi}K`,
            putOi: `${putOi}K`,
            callLtp: round(intrinsicCall + timeValue),
            putLtp: round(intrinsicPut + timeValue),
            isAtm,
            read
        };
    });
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
    const ticket = getTicketState(sim, selected.symbol, quote, worksheet);

    return `
        <div class="page-heading">
            <div>
                <h2>Live Market Simulator</h2>
                <p>Paper trading desk with a moving market, simulated news, watchlist, order ticket, stops, journal, and portfolio P&L. The learner practices decisions before opening a real trading platform.</p>
            </div>
            <div class="market-controls">
                <span class="summary-pill"><i data-lucide="clock"></i><span id="marketTimeText">${formatMarketTime(sim.tick)}</span></span>
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
            ${summaryPanel('Portfolio value', formatMoney(portfolio.value), portfolio.pnl >= 0 ? 'positive' : 'negative', `${formatSigned(portfolio.pnl)} total P&L`, 'portfolioValue', 'portfolioCaption')}
            ${summaryPanel('Cash', formatMoney(sim.cash), '', 'Virtual capital only', 'cashValue')}
            ${summaryPanel('Discipline', `${portfolio.discipline}%`, portfolio.discipline >= 70 ? 'positive' : 'negative', 'Stops, notes, and planned trades', 'disciplineValue')}
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
                                    <td id="quotePrice-${company.symbol}">${formatMoney(item.price)}</td>
                                    <td id="quoteChange-${company.symbol}" class="${item.change >= 0 ? 'positive' : 'negative'}">${formatSigned(item.changePct)}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </aside>

            <section class="panel">
                <div class="panel-title">
                    <h2>${selected.symbol} - ${escapeHTML(selected.name)}</h2>
                    <span id="selectedQuoteChange" class="status-pill ${quote.change >= 0 ? 'green' : 'red'}">${formatSigned(quote.changePct)}%</span>
                </div>
                <div class="chart-wrap">
                    <canvas id="marketChart" aria-label="Simulated price chart"></canvas>
                </div>
                <div class="chart-toolbar">
                    <div class="chart-type-switch" aria-label="Chart type">
                        <label class="chart-type-option ${sim.chartType !== 'candles' ? 'is-active' : ''}">
                            <input type="radio" name="chartType" data-chart-type value="line" ${sim.chartType !== 'candles' ? 'checked' : ''}>
                            <i data-lucide="line-chart"></i>
                            <span>Line</span>
                        </label>
                        <label class="chart-type-option ${sim.chartType === 'candles' ? 'is-active' : ''}">
                            <input type="radio" name="chartType" data-chart-type value="candles" ${sim.chartType === 'candles' ? 'checked' : ''}>
                            <i data-lucide="candlestick-chart"></i>
                            <span>Candles</span>
                        </label>
                    </div>
                    <div class="chart-range-switch" aria-label="History range">
                        ${CHART_RANGES.map(range => `
                            <button class="chart-range-button ${getChartRange(sim.chartRange).id === range.id ? 'is-active' : ''}" data-chart-range="${escapeAttr(range.id)}" type="button">
                                ${escapeHTML(range.label)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="chart-tools" aria-label="Chart tools">
                    ${CHART_TOOLS.map(tool => `
                        <label class="chart-tool" title="${escapeAttr(tool.help)}">
                            <input type="checkbox" data-chart-tool="${tool.id}" ${sim.tools[tool.id] ? 'checked' : ''}>
                            <span>${escapeHTML(tool.label)}</span>
                        </label>
                    `).join('')}
                </div>
                <details class="tool-guide">
                    <summary>What these tools tell you</summary>
                    <div class="table-responsive">
                        <table class="tool-table">
                            <thead><tr><th>Tool</th><th>What it tells you</th><th>Priority</th></tr></thead>
                            <tbody>
                                ${CHART_TOOLS.map(tool => `<tr><td>${escapeHTML(tool.name)}</td><td>${escapeHTML(tool.help)}</td><td>${escapeHTML(tool.priority)}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
                <div class="grid-3" style="margin-top:14px">
                    ${miniMetric('Support', formatMoney(selected.support))}
                    ${miniMetric('Resistance', formatMoney(selected.resistance))}
                    ${miniMetric('Volume', selected.volumeNote)}
                </div>
            </section>

            <aside class="panel">
                <div class="panel-title">
                    <h2>Order ticket</h2>
                    <span class="summary-pill"><span id="ticketQuoteText">${selected.symbol} ${formatMoney(quote.price)}</span></span>
                </div>
                ${!researchReady ? `
                    <div class="explanation" style="margin-bottom:12px">Training rule: write a research thesis and risk note before placing a paper order. You can still use Guest Mode for testing.</div>
                ` : ''}
                <div class="field-grid">
                    <div class="ticket-grid">
                        <label class="field">
                            <span>Side</span>
                            <select id="ticketSide" data-ticket-field>
                                ${selectOptions(['Buy', 'Sell'], ticket.side)}
                            </select>
                        </label>
                        <label class="field">
                            <span>Order</span>
                            <select id="ticketType" data-ticket-field>
                                ${selectOptions(['Market', 'Limit'], ticket.type)}
                            </select>
                        </label>
                        <label class="field">
                            <span>Qty</span>
                            <input id="ticketQty" data-ticket-field type="number" min="1" step="1" value="${escapeAttr(ticket.qty)}">
                        </label>
                    </div>
                    <div class="ticket-grid">
                        <label class="field">
                            <span>Limit price</span>
                            <input id="ticketLimit" data-ticket-field type="number" min="1" step="0.05" value="${escapeAttr(ticket.limit)}">
                        </label>
                        <label class="field">
                            <span>Stop loss</span>
                            <input id="ticketStop" data-ticket-field type="number" min="1" step="0.05" value="${escapeAttr(ticket.stop)}">
                        </label>
                    </div>
                    <label class="field">
                        <span>Trade note</span>
                        <textarea id="tradeNote" data-ticket-field placeholder="Why this trade, what proves it wrong, and what emotion to avoid.">${escapeHTML(ticket.note || '')}</textarea>
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

async function openResearchHelp(button) {
    let context = {};
    try {
        context = JSON.parse(button.dataset.helpContext || '{}');
    } catch {
        context = { topic: button.dataset.helpTopic || 'Research help' };
    }

    const company = COMPANIES[app.selectedCompany] || COMPANIES[DEFAULT_SYMBOL];
    const page = RESEARCH_PAGES.find(item => item.id === app.selectedResearchPage) || RESEARCH_PAGES[0];
    const richContext = {
        ...context,
        companyName: company.name,
        companyMetrics: pickCompanyMetrics(company),
        pageLabel: page.label,
        moduleTitle: getModule(app.activeModuleId).title
    };

    app.researchHelp = {
        open: true,
        loading: true,
        title: context.label || context.topic || 'Research help',
        context: richContext,
        messages: [{ role: 'assistant', content: 'Is section ko simple Hinglish mein explain kar raha hoon...' }]
    };
    renderPreservingResearchState({ scrollHelpToBottom: true, focusSelector: '[data-help-question]' });

    const answer = await fetchResearchHelp({
        question: '',
        context: richContext,
        messages: []
    });
    app.researchHelp.loading = false;
    app.researchHelp.messages = [{ role: 'assistant', content: answer }];
    renderPreservingResearchState({ scrollHelpToBottom: true, focusSelector: '[data-help-question]' });
}

async function sendResearchHelpQuestion() {
    const input = document.querySelector('[data-help-question]');
    const question = input ? input.value.trim() : '';
    if (!question || app.researchHelp.loading) return;

    app.researchHelp.messages.push({ role: 'user', content: question });
    app.researchHelp.messages.push({ role: 'assistant', content: 'Soch raha hoon... ek practical Hinglish answer de raha hoon.' });
    app.researchHelp.loading = true;
    renderPreservingResearchState({ scrollHelpToBottom: true, focusSelector: '[data-help-question]' });

    const answer = await fetchResearchHelp({
        question,
        context: app.researchHelp.context || {},
        messages: app.researchHelp.messages.slice(0, -1)
    });
    app.researchHelp.messages[app.researchHelp.messages.length - 1] = { role: 'assistant', content: answer };
    app.researchHelp.loading = false;
    renderPreservingResearchState({ scrollHelpToBottom: true, focusSelector: '[data-help-question]' });
}

async function fetchResearchHelp(payload) {
    try {
        const response = await fetchJson('/api/investing-lab/research-help', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return response.answer || response.feedback || 'AI se explanation nahi aaya. Dobara try karo ya question thoda specific likho.';
    } catch (error) {
        return localResearchHelp(payload.context, payload.question);
    }
}

async function requestAIFeedback() {
    const profile = activeProfile();
    const company = COMPANIES[app.selectedCompany] || COMPANIES[DEFAULT_SYMBOL];
    const worksheet = readWorksheetForm();
    profile.research.worksheets[company.symbol] = worksheet;
    profile.research.aiFeedback[company.symbol] = { source: 'loading', feedback: 'Coach tumhari interpretation review kar raha hai...' };
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
            feedback: response.feedback || 'AI se feedback nahi aaya. Dobara try karo ya thesis thoda specific likho.'
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
    profile.sim.ticket = null;
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
        if (app.view === 'simulator') {
            if (isEditingTicket()) {
                updateSimulatorLiveDom();
                requestAnimationFrame(drawMarketChart);
            } else {
                render();
            }
        }
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
        if (history.length > MAX_HISTORY_POINTS) history.shift();

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
    const quote = getQuote(symbol);
    captureTicketDraft();
    const ticket = getTicketState(sim, symbol, quote, getWorksheet(profile, symbol));
    const side = String(ticket.side || 'Buy').toLowerCase();
    const type = String(ticket.type || 'Market').toLowerCase();
    const qty = Math.floor(Number(ticket.qty));
    const limit = Number(ticket.limit);
    const stop = Number(ticket.stop);
    const note = String(ticket.note || '').trim();

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

function handleLiveInput(event) {
    const profile = activeProfile();
    if (!profile) return;

    if (event.target.matches('[data-ticket-field]')) {
        captureTicketDraft();
        saveSoon();
        requestAnimationFrame(drawMarketChart);
        return;
    }

    if (event.target.matches('[data-chart-tool]')) {
        const tool = event.target.dataset.chartTool;
        profile.sim.tools = { ...defaultChartTools(), ...(profile.sim.tools || {}) };
        profile.sim.tools[tool] = event.target.checked;
        profile.sim.toolsVersion = 2;
        saveSoon();
        requestAnimationFrame(drawMarketChart);
    }

    if (event.target.matches('[data-chart-type]')) {
        profile.sim.chartType = event.target.value === 'candles' ? 'candles' : 'line';
        document.querySelectorAll('.chart-type-option').forEach(option => {
            const input = option.querySelector('[data-chart-type]');
            option.classList.toggle('is-active', Boolean(input && input.checked));
        });
        saveSoon();
        requestAnimationFrame(drawMarketChart);
    }
}

function getTicketState(sim, symbol, quote, worksheet) {
    const company = COMPANIES[symbol] || COMPANIES[DEFAULT_SYMBOL];
    if (!isObject(sim.ticket) || sim.ticket.symbol !== symbol) {
        sim.ticket = {
            symbol,
            side: 'Buy',
            type: 'Market',
            qty: 10,
            limit: round(quote.price),
            stop: worksheet.stop || round(company.support * 0.97),
            note: worksheet.thesis || ''
        };
    }

    sim.ticket.side = ['Buy', 'Sell'].includes(sim.ticket.side) ? sim.ticket.side : 'Buy';
    sim.ticket.type = ['Market', 'Limit'].includes(sim.ticket.type) ? sim.ticket.type : 'Market';
    sim.ticket.qty = sim.ticket.qty || 10;
    sim.ticket.limit = sim.ticket.limit || round(quote.price);
    sim.ticket.stop = sim.ticket.stop || worksheet.stop || round(company.support * 0.97);
    sim.ticket.note = sim.ticket.note || '';
    return sim.ticket;
}

function captureTicketDraft() {
    const profile = activeProfile();
    if (!profile || app.view !== 'simulator') return;
    const side = document.getElementById('ticketSide');
    const type = document.getElementById('ticketType');
    const qty = document.getElementById('ticketQty');
    const limit = document.getElementById('ticketLimit');
    const stop = document.getElementById('ticketStop');
    const note = document.getElementById('tradeNote');
    if (!side || !type || !qty || !limit || !stop || !note) return;

    profile.sim.ticket = {
        symbol: app.selectedSymbol,
        side: side.value,
        type: type.value,
        qty: qty.value,
        limit: limit.value,
        stop: stop.value,
        note: note.value
    };
}

function isEditingTicket() {
    const active = document.activeElement;
    return Boolean(active && active.matches && active.matches('[data-ticket-field]'));
}

function updateSimulatorLiveDom() {
    const profile = activeProfile();
    if (!profile) return;
    const sim = profile.sim;
    const selected = COMPANIES[app.selectedSymbol] || COMPANIES[DEFAULT_SYMBOL];
    const quote = getQuote(selected.symbol);
    const portfolio = computePortfolio(sim);

    setText('marketTimeText', formatMarketTime(sim.tick));
    setText('portfolioValue', formatMoney(portfolio.value));
    setText('portfolioCaption', `${formatSigned(portfolio.pnl)} total P&L`);
    setText('cashValue', formatMoney(sim.cash));
    setText('disciplineValue', `${portfolio.discipline}%`);
    setText('ticketQuoteText', `${selected.symbol} ${formatMoney(quote.price)}`);
    setText('selectedQuoteChange', `${formatSigned(quote.changePct)}%`);
    const selectedQuote = document.getElementById('selectedQuoteChange');
    if (selectedQuote) {
        selectedQuote.classList.toggle('green', quote.change >= 0);
        selectedQuote.classList.toggle('red', quote.change < 0);
    }

    Object.values(COMPANIES).forEach(company => {
        const item = getQuote(company.symbol);
        setText(`quotePrice-${company.symbol}`, formatMoney(item.price));
        const change = document.getElementById(`quoteChange-${company.symbol}`);
        if (change) {
            change.textContent = `${formatSigned(item.changePct)}%`;
            change.classList.toggle('positive', item.change >= 0);
            change.classList.toggle('negative', item.change < 0);
        }
    });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function readWorksheetForm() {
    const root = document.querySelector('.research-modal .worksheet-panel') || document.querySelector('.research-grid .worksheet-panel') || document;
    const field = name => root.querySelector(`[data-worksheet-field="${name}"]`);

    return {
        decision: field('decision').value,
        thesis: field('thesis').value.trim(),
        risk: field('risk').value.trim(),
        entry: numberOrBlank(field('entry').value),
        stop: numberOrBlank(field('stop').value),
        target: numberOrBlank(field('target').value),
        confidence: Number(field('confidence').value) || 50,
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
    if (!Array.isArray(questions) || !questions.length) return 0;
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
    const scoredModules = MODULES.filter(module => !module.guide);
    const questionTotals = scoredModules.flatMap(module => QUESTION_BANK[module.id] || []);
    let correct = 0;
    let submitted = 0;
    scoredModules.forEach(module => {
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
    const testsPassed = scoredModules.filter(module => getTestScore(getTestState(profile, module.id), QUESTION_BANK[module.id]) >= 70).length;
    const testScore = questionTotals.length ? Math.round((correct / questionTotals.length) * 100) : 0;
    const discipline = trades ? Math.round((plannedTrades / trades) * 100) : 0;
    const mastery = Math.min(100, Math.round(
        (testsPassed / scoredModules.length) * 34
        + (worksheets / scoredModules.length) * 28
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
    const tools = { ...defaultChartTools(), ...(sim.tools || {}) };
    const chartType = sim.chartType === 'candles' ? 'candles' : 'line';
    const chartRange = getChartRange(sim.chartRange);
    const rawCandles = buildCandles(history, company);
    const candles = getVisibleChartCandles(rawCandles, chartRange);
    const closePrices = candles.map(candle => candle.close);
    const latest = closePrices[closePrices.length - 1];
    const firstClose = closePrices[0];
    const ticket = isObject(sim.ticket) && sim.ticket.symbol === symbol ? sim.ticket : null;
    const worksheet = getWorksheet(profile, symbol);
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(220, Math.floor(rect.height * dpr));

    const ctx = canvas.getContext('2d');
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const chartColor = latest >= firstClose ? '#089981' : '#f23645';
    const indicatorBands = (tools.rsi ? 52 : 0) + (tools.atr ? 44 : 0);
    const volumeBand = tools.volume ? 58 : 0;
    const pad = {
        left: width < 560 ? 12 : 18,
        right: width < 560 ? 82 : 104,
        top: 38,
        bottom: 34 + volumeBand + indicatorBands
    };
    const markers = collectChartMarkers({ sim, symbol, company, ticket, worksheet, tools, latest, firstClose });
    const prices = chartType === 'candles'
        ? candles.flatMap(candle => [candle.high, candle.low])
        : closePrices.slice();
    if (tools.ema20) prices.push(...calculateEMA(closePrices, 20).filter(Number.isFinite));
    if (tools.ema50) prices.push(...calculateEMA(closePrices, 50).filter(Number.isFinite));
    if (tools.ema200) prices.push(...calculateEMA(closePrices, 200).filter(Number.isFinite));
    if (tools.vwap) prices.push(...calculateVWAP(candles).filter(Number.isFinite));
    const baseMin = Math.min(...prices);
    const baseMax = Math.max(...prices);
    const baseRange = Math.max(0.01, baseMax - baseMin);
    const markerScaleBuffer = Math.max(baseRange * 1.5, latest * 0.045);
    markers
        .filter(marker => marker.value >= baseMin - markerScaleBuffer && marker.value <= baseMax + markerScaleBuffer)
        .forEach(marker => prices.push(marker.value));
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const rawRange = Math.max(0.01, rawMax - rawMin);
    const margin = Math.max(rawRange * 0.08, latest * 0.004);
    const min = rawMin - margin;
    const max = rawMax + margin;
    const plotBottom = height - pad.bottom;
    const plotHeight = plotBottom - pad.top;
    const plotRight = width - pad.right;
    const xFor = index => pad.left + (index / Math.max(1, candles.length - 1)) * (plotRight - pad.left);
    const yFor = price => pad.top + (max - price) / Math.max(0.01, max - min) * plotHeight;

    drawTradingGrid(ctx, { width, height, pad, min, max, candles, xFor, yFor, plotBottom, chartRange });
    drawChartHeader(ctx, { symbol, chartType, candles, latest, color: chartColor, pad, width, chartRange });

    if (tools.trend) {
        const first = candles[0].close;
        const last = candles[candles.length - 1].close;
        const channel = Math.max(1, (max - min) * 0.13);
        drawTrendLine(ctx, xFor(0), yFor(first), xFor(candles.length - 1), yFor(last), '#5f6b7a', 'Trend channel');
        drawTrendLine(ctx, xFor(0), yFor(first + channel), xFor(candles.length - 1), yFor(last + channel), '#c9d3e3');
        drawTrendLine(ctx, xFor(0), yFor(first - channel), xFor(candles.length - 1), yFor(last - channel), '#c9d3e3');
    }

    const candleWidth = Math.max(4, Math.min(13, (plotRight - pad.left) / candles.length * 0.64));
    if (chartType === 'candles') {
        drawTradingCandles(ctx, candles, xFor, yFor, candleWidth);
    } else {
        drawTradingLine(ctx, closePrices, xFor, yFor, pad, plotBottom, chartColor);
    }

    if (tools.ema20) drawSeriesLine(ctx, calculateEMA(closePrices, 20), xFor, yFor, '#1a73e8', 'EMA 20');
    if (tools.ema50) drawSeriesLine(ctx, calculateEMA(closePrices, 50), xFor, yFor, '#6f42c1', 'EMA 50');
    if (tools.ema200) drawSeriesLine(ctx, calculateEMA(closePrices, 200), xFor, yFor, '#b7791f', 'EMA 200');
    if (tools.vwap) drawSeriesLine(ctx, calculateVWAP(candles), xFor, yFor, '#202124', 'VWAP');

    if (tools.volume) {
        const top = plotBottom + 12;
        const bandHeight = 42;
        const maxVolume = Math.max(...candles.map(candle => candle.volume));
        ctx.fillStyle = '#5f6b7a';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Volume', pad.left, top + 9);
        candles.forEach((candle, index) => {
            const x = xFor(index);
            const barHeight = Math.max(2, (candle.volume / maxVolume) * (bandHeight - 12));
            ctx.fillStyle = candle.close >= candle.open ? 'rgba(18,128,92,0.35)' : 'rgba(180,35,24,0.28)';
            ctx.fillRect(x - candleWidth / 2, top + bandHeight - barHeight, candleWidth, barHeight);
        });
    }

    drawChartMarkers(ctx, markers, yFor, { width, pad, plotBottom });
    drawCurrentPoint(ctx, xFor(candles.length - 1), yFor(latest), chartColor);

    let indicatorTop = plotBottom + volumeBand + 10;
    if (tools.rsi) {
        indicatorTop = drawBoundedIndicator(ctx, calculateRSI(closePrices, 14), xFor, indicatorTop, width, pad, 0, 100, 'RSI 14', '#1a73e8');
    }
    if (tools.atr) {
        const atr = calculateATR(candles, 14);
        const maxAtr = Math.max(...atr.filter(Number.isFinite), 1);
        drawBoundedIndicator(ctx, atr, xFor, indicatorTop, width, pad, 0, maxAtr * 1.1, 'ATR 14', '#b7791f');
    }
}

function getChartRange(id) {
    return CHART_RANGES.find(range => range.id === id) || CHART_RANGES[0];
}

function getVisibleChartCandles(rawCandles, chartRange) {
    const source = Number.isFinite(chartRange.sourceBars)
        ? rawCandles.slice(-chartRange.sourceBars)
        : rawCandles.slice();
    const bucket = chartRange.bucket === 'auto'
        ? Math.max(1, Math.ceil(source.length / chartRange.targetBars))
        : Math.max(1, chartRange.bucket);
    return aggregateChartCandles(source, bucket).slice(-chartRange.targetBars);
}

function aggregateChartCandles(candles, bucket) {
    if (bucket <= 1 || candles.length <= 1) return candles.slice();
    const result = [];
    for (let end = candles.length; end > 0; end -= bucket) {
        const group = candles.slice(Math.max(0, end - bucket), end);
        if (!group.length) continue;
        result.unshift({
            tick: group[group.length - 1].tick,
            startTick: group[0].startTick == null ? group[0].tick : group[0].startTick,
            endTick: group[group.length - 1].endTick == null ? group[group.length - 1].tick : group[group.length - 1].endTick,
            open: group[0].open,
            high: round(Math.max(...group.map(candle => candle.high))),
            low: round(Math.min(...group.map(candle => candle.low))),
            close: group[group.length - 1].close,
            volume: group.reduce((total, candle) => total + candle.volume, 0)
        });
    }
    return result;
}

function drawTradingGrid(ctx, { width, height, pad, min, max, candles, xFor, yFor, plotBottom, chartRange }) {
    const plotRight = width - pad.right;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#edf1f7';
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6b7280';
    for (let i = 0; i <= 5; i += 1) {
        const price = max - i * (max - min) / 5;
        const y = yFor(price);
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(plotRight, y);
        ctx.stroke();
        ctx.fillText(formatChartPrice(price), plotRight + 8, y);
    }

    ctx.strokeStyle = '#f1f4f8';
    const verticalCount = Math.min(5, candles.length - 1);
    for (let i = 0; i <= verticalCount; i += 1) {
        const index = Math.round(i * (candles.length - 1) / Math.max(1, verticalCount));
        const x = xFor(index);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
    }

    ctx.strokeStyle = '#dfe5ef';
    ctx.beginPath();
    ctx.moveTo(plotRight, pad.top);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8491a3';
    const labelY = Math.min(height - 10, plotBottom + 22);
    const labelCount = width < 560 ? 2 : 4;
    const latestTick = candles[candles.length - 1].tick;
    for (let i = 0; i <= labelCount; i += 1) {
        const index = Math.round(i * (candles.length - 1) / Math.max(1, labelCount));
        const label = formatChartAxisLabel(candles[index], latestTick, chartRange.id);
        const x = Math.min(plotRight - 34, Math.max(pad.left, xFor(index) - 18));
        ctx.fillText(label, x, labelY);
    }
    ctx.restore();
}

function drawChartHeader(ctx, { symbol, chartType, candles, latest, color, pad, width, chartRange }) {
    const last = candles[candles.length - 1];
    const mode = chartType === 'candles' ? 'Candles' : 'Line';
    const full = `${symbol} ${chartRange.label} ${mode}  O ${formatChartPrice(last.open)}  H ${formatChartPrice(last.high)}  L ${formatChartPrice(last.low)}  C ${formatChartPrice(latest)}`;
    const compact = `${symbol} ${chartRange.label} ${mode}  ${formatChartPrice(latest)}`;
    ctx.save();
    ctx.font = '12px Inter, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#111827';
    ctx.fillText(ctx.measureText(full).width < width - pad.left - pad.right ? full : compact, pad.left, 20);
    ctx.fillStyle = color;
    ctx.fillText(latest >= candles[0].close ? ' +live' : ' live', pad.left, 34);
    ctx.restore();
}

function formatChartAxisLabel(candle, latestTick, rangeId) {
    if (rangeId === '1D') return formatMarketTime(candle.tick);
    const ageTicks = Math.max(0, latestTick - candle.tick);
    const tradingDay = Math.max(0, Math.round(ageTicks / TRADING_DAY_TICKS));
    if (rangeId === '7D') return tradingDay === 0 ? 'Today' : `${tradingDay}D`;
    if (rangeId === '1M') return tradingDay === 0 ? 'Now' : `${tradingDay}D`;
    if (rangeId === '1Y') {
        const months = Math.max(0, Math.round(tradingDay / 21));
        return months === 0 ? 'Now' : `${months}M`;
    }
    if (tradingDay < 21) return tradingDay === 0 ? 'Now' : `${tradingDay}D`;
    return `${Math.round(tradingDay / 21)}M`;
}

function drawTradingCandles(ctx, candles, xFor, yFor, candleWidth) {
    ctx.save();
    candles.forEach((candle, index) => {
        const x = xFor(index);
        const yOpen = yFor(candle.open);
        const yClose = yFor(candle.close);
        const yHigh = yFor(candle.high);
        const yLow = yFor(candle.low);
        const rising = candle.close >= candle.open;
        const color = rising ? '#089981' : '#f23645';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(3, Math.abs(yOpen - yClose));
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
    ctx.restore();
}

function drawTradingLine(ctx, series, xFor, yFor, pad, plotBottom, color) {
    if (series.length < 2) return;
    ctx.save();
    const firstX = xFor(0);
    const lastX = xFor(series.length - 1);
    const gradient = ctx.createLinearGradient(0, pad.top, 0, plotBottom);
    gradient.addColorStop(0, color === '#089981' ? 'rgba(8,153,129,0.22)' : 'rgba(242,54,69,0.20)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    series.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(lastX, plotBottom);
    ctx.lineTo(firstX, plotBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    series.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
}

function drawCurrentPoint(ctx, x, y, color) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function collectChartMarkers({ sim, symbol, company, ticket, worksheet, tools, latest, firstClose }) {
    const markers = [{
        id: 'last',
        label: `${symbol} ${formatChartPrice(latest)}`,
        value: latest,
        color: latest >= firstClose ? '#089981' : '#f23645',
        dash: [],
        priority: 0,
        emphasis: true
    }];

    if (tools.levels) {
        markers.push({ id: 'support', label: `Sup ${formatChartPrice(company.support)}`, value: company.support, color: '#12805c', dash: [5, 5], priority: 5 });
        markers.push({ id: 'resistance', label: `Res ${formatChartPrice(company.resistance)}`, value: company.resistance, color: '#b7791f', dash: [5, 5], priority: 5 });
    }

    if (ticket) {
        const limit = Number(ticket.limit);
        const stop = Number(ticket.stop);
        if (Number.isFinite(limit) && limit > 0) {
            markers.push({
                id: 'ticket-limit',
                label: `${String(ticket.type || 'Limit').toLowerCase() === 'limit' ? 'Limit' : 'Ref'} ${formatChartPrice(limit)}`,
                value: limit,
                color: '#1a73e8',
                dash: [6, 5],
                priority: 1
            });
        }
        if (Number.isFinite(stop) && stop > 0) {
            markers.push({ id: 'ticket-stop', label: `Stop ${formatChartPrice(stop)}`, value: stop, color: '#f23645', dash: [4, 4], priority: 2 });
        }
    }

    const target = Number(worksheet && worksheet.target);
    if (Number.isFinite(target) && target > 0) {
        markers.push({ id: 'target', label: `Target ${formatChartPrice(target)}`, value: target, color: '#12805c', dash: [8, 5], priority: 3 });
    }

    const position = sim.positions && sim.positions[symbol];
    if (position && position.qty > 0) {
        if (Number.isFinite(Number(position.avg)) && Number(position.avg) > 0) {
            markers.push({ id: 'avg', label: `Avg ${formatChartPrice(position.avg)}`, value: Number(position.avg), color: '#6f42c1', dash: [3, 4], priority: 2 });
        }
        if (Number.isFinite(Number(position.stop)) && Number(position.stop) > 0) {
            markers.push({ id: 'position-stop', label: `Pos SL ${formatChartPrice(position.stop)}`, value: Number(position.stop), color: '#b42318', dash: [3, 4], priority: 2 });
        }
    }

    (sim.orders || [])
        .filter(order => order.symbol === symbol && order.status === 'pending' && Number.isFinite(Number(order.limit)))
        .slice(0, 3)
        .forEach(order => {
            markers.push({
                id: `pending-${order.id}`,
                label: `Pending ${formatChartPrice(order.limit)}`,
                value: Number(order.limit),
                color: '#1a73e8',
                dash: [2, 4],
                priority: 4
            });
        });

    return markers;
}

function drawChartMarkers(ctx, markers, yFor, { width, pad, plotBottom }) {
    const plotRight = width - pad.right;
    const visible = markers
        .map(marker => {
            const actualY = yFor(marker.value);
            const edge = actualY < pad.top ? 'above' : actualY > plotBottom ? 'below' : '';
            const y = Math.min(plotBottom - 2, Math.max(pad.top + 2, actualY));
            return { ...marker, actualY, y, edge, tagY: y };
        })
        .sort((a, b) => a.tagY - b.tagY || a.priority - b.priority);
    adjustMarkerLabels(visible, pad.top + 12, plotBottom - 12);

    visible
        .sort((a, b) => b.priority - a.priority)
        .forEach(marker => {
            ctx.save();
            ctx.strokeStyle = marker.color;
            ctx.lineWidth = marker.emphasis ? 1.4 : 1;
            ctx.globalAlpha = marker.emphasis ? 0.92 : 0.76;
            ctx.setLineDash(marker.dash || []);
            ctx.beginPath();
            ctx.moveTo(pad.left, marker.y);
            ctx.lineTo(plotRight, marker.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            drawMarkerTag(ctx, marker, plotRight + 7, marker.tagY, Math.max(68, pad.right - 14));
            if (Math.abs(marker.tagY - marker.y) > 2) {
                ctx.strokeStyle = marker.color;
                ctx.globalAlpha = 0.55;
                ctx.beginPath();
                ctx.moveTo(plotRight, marker.y);
                ctx.lineTo(plotRight + 5, marker.tagY);
                ctx.stroke();
            }
            ctx.restore();
        });
}

function adjustMarkerLabels(markers, minY, maxY) {
    const minGap = 22;
    markers.forEach(marker => {
        marker.tagY = Math.min(maxY, Math.max(minY, marker.tagY));
    });
    for (let i = 1; i < markers.length; i += 1) {
        if (markers[i].tagY - markers[i - 1].tagY < minGap) {
            markers[i].tagY = markers[i - 1].tagY + minGap;
        }
    }
    for (let i = markers.length - 1; i >= 0; i -= 1) {
        if (markers[i].tagY > maxY) markers[i].tagY = maxY;
        if (i > 0 && markers[i].tagY - markers[i - 1].tagY < minGap) {
            markers[i - 1].tagY = markers[i].tagY - minGap;
        }
    }
    markers.forEach(marker => {
        marker.tagY = Math.min(maxY, Math.max(minY, marker.tagY));
    });
}

function drawMarkerTag(ctx, marker, x, centerY, maxWidth) {
    const height = marker.emphasis ? 22 : 20;
    const text = `${marker.edge === 'above' ? '> ' : marker.edge === 'below' ? '< ' : ''}${marker.label}`;
    const y = centerY - height / 2;
    ctx.save();
    ctx.font = `${marker.emphasis ? 11 : 10}px Inter, sans-serif`;
    const width = Math.min(maxWidth, Math.max(marker.emphasis ? 78 : 70, ctx.measureText(text).width + 14));
    ctx.fillStyle = marker.color;
    drawRoundRect(ctx, x, y, width, height, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 7, centerY + 0.5);
    ctx.restore();
}

function drawRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function formatChartPrice(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function drawTrendLine(ctx, x1, y1, x2, y2, color, label = '') {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
        ctx.fillStyle = color;
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(label, x1 + 8, y1 - 6);
    }
    ctx.restore();
}

function drawMainPriceLine(ctx, series, xFor, yFor, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    series.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
}

function drawSeriesLine(ctx, series, xFor, yFor, color, label) {
    const points = series
        .map((value, index) => ({ value, index }))
        .filter(point => Number.isFinite(point.value));
    if (points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    points.forEach((point, index) => {
        const x = xFor(point.index);
        const y = yFor(point.value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const last = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(label, xFor(last.index) - 42, yFor(last.value) - 7);
    ctx.restore();
}

function drawBoundedIndicator(ctx, series, xFor, top, width, pad, min, max, label, color) {
    const height = 42;
    const yFor = value => top + (max - value) / Math.max(1, max - min) * height;
    ctx.save();
    ctx.strokeStyle = '#e6ebf2';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad.left, top, width - pad.left - pad.right, height);
    ctx.fillStyle = '#5f6b7a';
    ctx.font = '12px Inter, sans-serif';
    const latest = [...series].reverse().find(Number.isFinite);
    ctx.fillText(`${label}${Number.isFinite(latest) ? ` ${round(latest)}` : ''}`, pad.left + 8, top + 14);
    drawSeriesLine(ctx, series, xFor, yFor, color, label);
    ctx.restore();
    return top + height + 10;
}

function buildCandles(history, company) {
    return history.map((point, index) => {
        const previousClose = index > 0 ? history[index - 1].price : point.price * (1 - (pseudoRandom(index, company.seed) - 0.5) / 200);
        const close = point.price;
        const spread = Math.max(close * 0.002, company.volatility * (0.6 + pseudoRandom(index + 3, company.seed)));
        const high = Math.max(previousClose, close) + spread;
        const low = Math.max(1, Math.min(previousClose, close) - spread);
        const volume = Math.round(90000 * (1 + company.volatility) * (0.7 + pseudoRandom(index + 9, company.seed) * 1.1));
        return {
            tick: point.tick,
            open: round(previousClose),
            high: round(high),
            low: round(low),
            close: round(close),
            volume
        };
    });
}

function calculateEMA(values, period) {
    if (!values.length) return [];
    const smoothing = 2 / (Math.min(period, values.length) + 1);
    const result = [];
    let ema = values[0];
    values.forEach((value, index) => {
        ema = index === 0 ? value : value * smoothing + ema * (1 - smoothing);
        result.push(round(ema));
    });
    return result;
}

function calculateVWAP(candles) {
    let pv = 0;
    let volume = 0;
    return candles.map(candle => {
        const typical = (candle.high + candle.low + candle.close) / 3;
        pv += typical * candle.volume;
        volume += candle.volume;
        return round(pv / volume);
    });
}

function calculateRSI(values, period = 14) {
    return values.map((value, index) => {
        if (index === 0) return NaN;
        const start = Math.max(1, index - period + 1);
        let gains = 0;
        let losses = 0;
        for (let i = start; i <= index; i++) {
            const change = values[i] - values[i - 1];
            if (change >= 0) gains += change;
            else losses += Math.abs(change);
        }
        if (losses === 0) return 100;
        const rs = gains / losses;
        return round(100 - (100 / (1 + rs)));
    });
}

function calculateATR(candles, period = 14) {
    return candles.map((candle, index) => {
        const start = Math.max(0, index - period + 1);
        let total = 0;
        let count = 0;
        for (let i = start; i <= index; i++) {
            const previousClose = i > 0 ? candles[i - 1].close : candles[i].open;
            const trueRange = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - previousClose),
                Math.abs(candles[i].low - previousClose)
            );
            total += trueRange;
            count += 1;
        }
        return round(total / Math.max(1, count));
    });
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
            <span>${escapeHTML(label)} ${helpButton(label, label, help, { value })}</span>
            <strong>${escapeHTML(String(value))}</strong>
            <p>${escapeHTML(help)}</p>
        </div>
    `;
}

function helpButton(topic, label, help, options = {}) {
    const payload = {
        topic,
        label,
        value: options.value == null ? '' : String(options.value),
        help,
        company: app.selectedCompany,
        page: app.selectedResearchPage,
        module: app.activeModuleId
    };
    return `
        <button class="help-button ${options.compact ? 'compact' : ''}" type="button" aria-label="Ask AI about ${escapeAttr(label)}" data-help-topic="${escapeAttr(topic)}" data-help-context="${escapeAttr(JSON.stringify(payload))}">
            ?
        </button>
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

function summaryPanel(label, value, tone, caption, valueId = '', captionId = '') {
    return `
        <div class="panel">
            <span class="label">${escapeHTML(label)}</span>
            <h2 ${valueId ? `id="${valueId}"` : ''} class="${tone || ''}" style="margin:6px 0 4px">${escapeHTML(String(value))}</h2>
            <p ${captionId ? `id="${captionId}"` : ''} style="margin:0;color:var(--muted);font-size:.88rem">${escapeHTML(caption)}</p>
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

function selectOptions(values, selected) {
    return values.map(value => `<option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${escapeHTML(value)}</option>`).join('');
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

function localResearchHelp(context = {}, question = '') {
    const label = context.label || context.topic || 'this section';
    const value = context.value ? ` Current value: ${context.value}.` : '';
    const help = context.help || 'Is section ka use raw market information ko clear decision, risk check, aur action plan mein convert karne ke liye hota hai.';
    const ask = question ? `\n\nTumhare question ke liye focus karo: ${question}` : '';
    return `**${label}**\n\n${help}${value}\n\nKya karna hai:\n- Pehle identify karo ye number/section kya measure karta hai.\n- Decide karo ye tumhari thesis ko support karta hai, weak karta hai, ya neutral hai.\n- Trade se pehle isko risk, price level, aur opposite evidence ke saath compare karo.${ask}`;
}

function pseudoRandom(a, b) {
    const x = Math.sin((a + 1) * (b + 11) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function formatMarketTime(tick) {
    const dayTick = ((Math.round(Number(tick) || 0) % TRADING_DAY_TICKS) + TRADING_DAY_TICKS) % TRADING_DAY_TICKS;
    const minutes = MARKET_OPEN_MINUTES + dayTick * MARKET_TICK_MINUTES;
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

function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r/g, '').split('\n');
    let html = '';
    let list = null;

    const closeList = () => {
        if (list) {
            html += `</${list}>`;
            list = null;
        }
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const rawLine = lines[lineIndex];
        const line = rawLine.trim();
        if (!line) {
            closeList();
            continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
            closeList();
            html += '<hr>';
            continue;
        }

        if (isMarkdownTableStart(lines, lineIndex)) {
            closeList();
            const table = collectMarkdownTable(lines, lineIndex);
            html += renderMarkdownTable(table.rows);
            lineIndex = table.nextIndex - 1;
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            closeList();
            const level = Math.min(4, heading[1].length + 2);
            html += `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`;
            continue;
        }

        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
            if (list !== 'ul') {
                closeList();
                html += '<ul>';
                list = 'ul';
            }
            html += `<li>${renderInlineMarkdown(bullet[1])}</li>`;
            continue;
        }

        const numbered = line.match(/^\d+[.)]\s+(.+)$/);
        if (numbered) {
            if (list !== 'ol') {
                closeList();
                html += '<ol>';
                list = 'ol';
            }
            html += `<li>${renderInlineMarkdown(numbered[1])}</li>`;
            continue;
        }

        closeList();
        html += `<p>${renderInlineMarkdown(line)}</p>`;
    }

    closeList();
    return html;
}

function isMarkdownTableStart(lines, index) {
    const current = String(lines[index] || '').trim();
    const next = String(lines[index + 1] || '').trim();
    return current.includes('|') && /^\|?[\s:-]+\|[\s|:-]*$/.test(next);
}

function collectMarkdownTable(lines, startIndex) {
    const rows = [];
    let index = startIndex;
    while (index < lines.length) {
        const line = String(lines[index] || '').trim();
        if (!line.includes('|')) break;
        if (!/^\|?[\s:-]+\|[\s|:-]*$/.test(line)) {
            rows.push(splitMarkdownTableRow(line));
        }
        index += 1;
    }
    return { rows, nextIndex: index };
}

function splitMarkdownTableRow(line) {
    return line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim());
}

function renderMarkdownTable(rows) {
    if (!rows.length) return '';
    const [head, ...body] = rows;
    return `
        <div class="markdown-table-wrap">
            <table>
                <thead><tr>${head.map(cell => `<th>${renderInlineMarkdown(cell)}</th>`).join('')}</tr></thead>
                <tbody>
                    ${body.map(row => `<tr>${head.map((_, index) => `<td>${renderInlineMarkdown(row[index] || '')}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderInlineMarkdown(text) {
    return escapeHTML(text)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
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
