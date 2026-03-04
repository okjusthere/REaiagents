// ── Content Module Topic Pools ──────────────────────────────
// Each module has a pool of topics that rotate daily.
// The system picks N topics per module per day to generate scripts.

export interface TopicItem {
    id: string;
    title: string;        // Topic title for the AI prompt
    angle: string;        // Specific angle or focus
    keywords: string[];   // SEO / hashtag keywords
}

export interface ContentModule {
    id: string;
    name: string;
    emoji: string;
    description: string;
    topicsPerDay: number;  // How many topics to pick daily
    topics: TopicItem[];
}

export const contentModules: ContentModule[] = [
    // ── M2: 买家教育 ────────────────────────────────────────
    {
        id: 'buyer-education',
        name: '买家教育',
        emoji: '🎓',
        description: '首次购房指南、贷款攻略、买房避坑',
        topicsPerDay: 2,
        topics: [
            { id: 'b01', title: '美国买房完整流程', angle: '从Pre-approval到Closing的每一步详解，重点强调新手最容易遗漏的环节', keywords: ['美国买房', '购房流程', '首次买房'] },
            { id: 'b02', title: 'FHA vs Conventional vs Jumbo 贷款对比', angle: '不同贷款类型的首付比例、利率、适用人群对比，帮助观众找到最适合自己的', keywords: ['房贷', 'FHA贷款', '贷款对比'] },
            { id: 'b03', title: '信用分数与买房', angle: '信用分对利率的具体影响（举例：740分vs680分月供差多少），快速提分的3个实操方法', keywords: ['信用分', '买房信用', '提高信用分'] },
            { id: 'b04', title: 'Closing Cost 详解', angle: '买房的隐藏费用清单，每项大概多少钱，哪些可以谈判减免', keywords: ['Closing Cost', '买房费用', '过户费'] },
            { id: 'b05', title: '验房 Home Inspection 避坑', angle: '验房报告中最关键的5项（地基、屋顶、电路、管道、白蚁），发现问题该怎么谈判', keywords: ['验房', 'Home Inspection', '买房避坑'] },
            { id: 'b06', title: 'Pre-approval 的重要性', angle: '没有Pre-approval为什么卖家不理你，如何快速拿到，有效期多长', keywords: ['Pre-approval', '贷款预批', '买房准备'] },
            { id: 'b07', title: '多人竞价 Bidding War 策略', angle: '不一定要出最高价才能赢，Escalation Clause、灵活Closing日期等策略', keywords: ['竞价', 'Bidding War', '抢房策略'] },
            { id: 'b08', title: 'Co-op vs Condo 区别', angle: '纽约特色：产权结构、Board审批、转售限制、贷款差异的全面对比', keywords: ['Co-op', 'Condo', '纽约买房'] },
            { id: 'b09', title: '学区房选择指南', angle: '学区评分不是唯一指标：升学率、师生比、课外活动、家长评价才是关键', keywords: ['学区房', '纽约学区', '买房选学区'] },
            { id: 'b10', title: '产权保险 Title Insurance', angle: '很多人觉得没用但其实是最重要的保障：真实案例说明遗留产权纠纷的风险', keywords: ['产权保险', 'Title Insurance', '买房保险'] },
        ],
    },

    // ── M3: 卖家教育 ────────────────────────────────────────
    {
        id: 'seller-education',
        name: '卖家教育',
        emoji: '🏠',
        description: '卖房定价、Staging技巧、税务规划',
        topicsPerDay: 2,
        topics: [
            { id: 's01', title: '卖房定价策略', angle: '定价过高为什么反而卖不掉（DOM越长越贬值），CMA分析的正确用法', keywords: ['卖房定价', '房价评估', 'CMA分析'] },
            { id: 's02', title: 'Home Staging 投入产出比', angle: '花最少的钱让房子卖最好的价，哪些房间值得投入，DIY vs 专业Staging', keywords: ['Staging', '卖房装修', '房屋美化'] },
            { id: 's03', title: '纽约卖房最佳时机', angle: '按月份分析成交数据：春季（3-5月）通常最好，但也有例外', keywords: ['卖房时机', '最佳季节', '纽约卖房'] },
            { id: 's04', title: 'Open House 准备清单', angle: '从清洁、除味、灯光到当天接待的完整SOP', keywords: ['Open House', '看房日', '卖房准备'] },
            { id: 's05', title: '厨房/浴室翻新 ROI', angle: '不同翻新项目的投资回报率数据对比，花5万翻新到底能多卖多少', keywords: ['翻新ROI', '厨房翻新', '房屋增值'] },
            { id: 's06', title: 'FSBO 自己卖房的风险', angle: '看似省了佣金但隐藏的定价失误、法律风险、曝光不足等问题', keywords: ['FSBO', '自己卖房', '卖房风险'] },
            { id: 's07', title: '多Offer怎么选', angle: '不只看价格：Contingency条件、买家资质、Closing时间都要考虑', keywords: ['多Offer', '卖房选价', '出价对比'] },
            { id: 's08', title: '卖房 Capital Gains Tax', angle: '自住2年免税额度（单人$25万/夫妻$50万），超出部分怎么算', keywords: ['卖房税', 'Capital Gains', '房产税务'] },
            { id: 's09', title: '卖房后搬家倒计时', angle: '30天/14天/7天/1天应该做什么的详细清单', keywords: ['搬家', '卖房搬家', '搬家清单'] },
        ],
    },

    // ── M4: 投资分析 ────────────────────────────────────────
    {
        id: 'investment',
        name: '投资分析',
        emoji: '💰',
        description: '房产投资策略、现金流分析、税务优化',
        topicsPerDay: 2,
        topics: [
            { id: 'i01', title: '投资房现金流分析', angle: '用具体数字算账：月租$3000的房子，扣完贷款、税、保险、维修到底剩多少', keywords: ['现金流', '投资房', '租金收入'] },
            { id: 'i02', title: 'Cap Rate 计算和应用', angle: '什么是好的Cap Rate？纽约各区域的Cap Rate对比，如何用它做投资决策', keywords: ['Cap Rate', '投资回报率', '房产投资'] },
            { id: 'i03', title: '1031 Exchange 延税策略', angle: '卖投资房不交税的合法操作：时间线、规则、常见错误', keywords: ['1031 Exchange', '延税', '投资策略'] },
            { id: 'i04', title: '2-4 Family 多家庭投资', angle: '自住一层租出其他层：贷款优势（可用FHA）、管理技巧、现金流计算', keywords: ['多家庭', 'Multi-family', '以租养贷'] },
            { id: 'i05', title: '短租 Airbnb vs 长租对比', angle: '纽约短租新规之下哪个更赚钱？收入、管理成本、法律风险的全面对比', keywords: ['Airbnb', '短租vs长租', '纽约短租'] },
            { id: 'i06', title: '租售比分析', angle: '这个关键指标决定你该买还是租，纽约各区域数据对比', keywords: ['租售比', '买vs租', '投资指标'] },
            { id: 'i07', title: '房产折旧抵税', angle: '每年合法省几千刀税，Depreciation怎么算，Cost Segregation加速折旧', keywords: ['折旧抵税', 'Depreciation', '税务策略'] },
            { id: 'i08', title: 'REITs vs 实物房产投资', angle: '没钱买整栋房也能投资房产：REITs的优缺点和适合人群', keywords: ['REITs', '房产基金', '投资对比'] },
            { id: 'i09', title: '海外买家在美国买房', angle: '签证类型、贷款渠道、税务影响、FIRPTA预扣税详解', keywords: ['海外买家', '外国人买房', '美国房产'] },
            { id: 'i10', title: '商业地产入门', angle: '从住宅投资过渡到商业地产：NNN Lease、商铺、办公楼的基础知识', keywords: ['商业地产', 'NNN Lease', '商铺投资'] },
        ],
    },

    // ── M5: 社区生活 ────────────────────────────────────────
    {
        id: 'community',
        name: '社区生活',
        emoji: '🏘️',
        description: '纽约社区深度介绍、区域对比、生活指南',
        topicsPerDay: 1,
        topics: [
            { id: 'c01', title: '法拉盛 Flushing 深度指南', angle: '华人社区的核心：美食、学区、房价走势、交通（7号线）、适合什么人群', keywords: ['法拉盛', 'Flushing', '纽约华人区'] },
            { id: 'c02', title: '长岛 Long Island 生活体验', angle: '北岸vs南岸对比、通勤路线、学区排名、房价段位分析', keywords: ['长岛', 'Long Island', '长岛买房'] },
            { id: 'c03', title: 'Bayside 贝赛社区', angle: '安静高品质的皇后区社区：房型分析、Bell Boulevard商圈、公园系统', keywords: ['Bayside', '贝赛', '皇后区'] },
            { id: 'c04', title: '布鲁克林 日落公园 Sunset Park', angle: '华人新兴社区：八大道商圈、房价性价比、未来发展潜力', keywords: ['日落公园', '八大道', '布鲁克林'] },
            { id: 'c05', title: 'Forest Hills 森林小丘', angle: '皇后区的"小曼哈顿"：Tudor风格建筑、优质学区、咖啡文化', keywords: ['Forest Hills', '森林小丘', '皇后区生活'] },
            { id: 'c06', title: '新泽西 Jersey City 通勤圈', angle: '曼哈顿对岸的性价比之选：PATH通勤、Hudson Yards景观、税务差异', keywords: ['Jersey City', '新泽西', '纽约通勤'] },
            { id: 'c07', title: 'Great Neck 大颈', angle: '顶级学区代名词：房价、学校、华人生活圈、豪宅市场', keywords: ['Great Neck', '大颈', '学区房'] },
            { id: 'c08', title: 'Astoria 阿斯托里亚', angle: '皇后区最时尚的社区：年轻人聚集、美食多元、N/W地铁交通便利', keywords: ['Astoria', '皇后区', '年轻人社区'] },
            { id: 'c09', title: '皇后区 vs 长岛 全面对比', angle: '同样预算在两个区域能买到什么？通勤、学区、生活配套的差距', keywords: ['皇后区vs长岛', '区域对比', '纽约买房'] },
            { id: 'c10', title: '曼哈顿 上东区 Upper East Side', angle: '老钱聚集地：博物馆大道、Central Park、顶级私校、Co-op文化', keywords: ['上东区', 'Upper East Side', '曼哈顿'] },
        ],
    },

    // ── M6: 市场数据 ────────────────────────────────────────
    {
        id: 'market-data',
        name: '市场数据',
        emoji: '📊',
        description: '利率追踪、市场趋势、区域数据分析',
        topicsPerDay: 1,
        topics: [
            { id: 'd01', title: '本周房贷利率解读', angle: '30年/15年固定利率走势，ARM vs固定利率选择建议，利率变化对月供的具体影响', keywords: ['房贷利率', '利率走势', '贷款利率'] },
            { id: 'd02', title: '纽约房价季节性规律', angle: '用历史数据揭示每个月的房价和成交量规律，帮助买家/卖家择时', keywords: ['房价季节', '最佳买房时间', '市场规律'] },
            { id: 'd03', title: '库存量与买家竞争', angle: '当前纽约各区库存月数分析：<3个月是卖方市场，>6个月是买方市场', keywords: ['库存量', '买方卖方市场', '市场分析'] },
            { id: 'd04', title: '租金走势播报', angle: '曼哈顿/皇后区/布鲁克林一居/两居租金中位数对比，租金涨幅分析', keywords: ['租金走势', '纽约租金', '租房市场'] },
            { id: 'd05', title: '房价中位数与收入比', angle: '纽约各区房价收入比对比：需要多少年收入才能买得起，负担能力分析', keywords: ['房价收入比', '买房负担', '市场数据'] },
            { id: 'd06', title: '新开发项目追踪', angle: '纽约在建/新建项目盘点，对周边房价的影响，哪些区域有新地铁/学校规划', keywords: ['新开发', '新建项目', '房产趋势'] },
            { id: 'd07', title: '止赎房 Foreclosure 市场', angle: '当前止赎率分析，是否有"捡漏"机会，买止赎房的流程和风险', keywords: ['止赎房', 'Foreclosure', '法拍房'] },
            { id: 'd08', title: '成交天数 DOM 分析', angle: '各区域平均挂牌到成交天数对比：DOM短=市场热，DOM长=有议价空间', keywords: ['成交天数', 'DOM', '市场热度'] },
        ],
    },

    // ── M7: 法律税务 ────────────────────────────────────────
    {
        id: 'legal-tax',
        name: '法律税务',
        emoji: '⚖️',
        description: '房产法律、税务规划、政策解读',
        topicsPerDay: 1,
        topics: [
            { id: 'l01', title: '纽约房产税怎么算', angle: '评估值vs市场值、税率计算、STAR减免/老年人减免申请方法', keywords: ['房产税', '纽约税', '税务减免'] },
            { id: 'l02', title: 'LLC 买房利弊', angle: '用LLC买房是否能保护隐私和资产？贷款限制、税务影响、哪些情况适合', keywords: ['LLC买房', '公司买房', '资产保护'] },
            { id: 'l03', title: '房产遗产规划', angle: '房子传给下一代的3种方式（继承/赠与/Trust）对比，哪种最省税', keywords: ['遗产规划', '房产继承', '家族信托'] },
            { id: 'l04', title: '纽约租客权利', angle: '租客必知的权利：押金规定、涨租限制、驱逐保护、维修请求权', keywords: ['租客权利', '纽约租房', '租客保护'] },
            { id: 'l05', title: 'H1B/F1签证买房指南', angle: '工作签证和学生签证能否买房贷款？银行要求、税号申请、注意事项', keywords: ['H1B买房', '留学生买房', '签证买房'] },
            { id: 'l06', title: 'Condo/Co-op Board 审批', angle: '被Board拒绝的常见原因、如何准备Board Package、面试技巧', keywords: ['Board审批', 'Co-op面试', '买房审批'] },
            { id: 'l07', title: 'Homeowner Insurance 选择', angle: '保什么不保什么？5项必要Coverage，洪水险/地震险是否需要额外买', keywords: ['房屋保险', '保险选择', '保险理赔'] },
            { id: 'l08', title: '房产合同关键条款', angle: 'Contingency（贷款/验房/评估）、Earnest Money、As-Is条款的含义和谈判', keywords: ['购房合同', '合同条款', '买房谈判'] },
            { id: 'l09', title: '出租房税务指南', angle: '哪些费用可以抵税？Schedule E怎么填？管理费、维修、差旅等扣除项详解', keywords: ['出租税务', '房东报税', '税务抵扣'] },
        ],
    },

    // ── M8: 个人品牌 ────────────────────────────────────────
    {
        id: 'personal-brand',
        name: '个人品牌',
        emoji: '🌟',
        description: '经纪人品牌建设、行业心得、互动内容',
        topicsPerDay: 1,
        topics: [
            { id: 'p01', title: '为什么选择地产经纪人而不是自己买卖', angle: '用具体案例说明经纪人在谈判、信息差、法律保护方面的价值', keywords: ['地产经纪', '经纪人价值', '买房建议'] },
            { id: 'p02', title: '我帮客户买到理想房子的故事', angle: '讲述一个典型成功案例：从需求分析到成交的全过程，突出专业价值', keywords: ['成交故事', '客户好评', '买房故事'] },
            { id: 'p03', title: '地产经纪人的一天', angle: '从早到晚的真实工作内容：看房、谈判、手续、客户沟通，展现专业和辛苦', keywords: ['经纪人日常', '地产工作', '幕后花絮'] },
            { id: 'p04', title: '粉丝问答：现在该买房还是等？', angle: '客观分析买和等的利弊，用数据说话，最终建议因人而异', keywords: ['买房时机', 'Q&A', '粉丝问答'] },
            { id: 'p05', title: '我对下半年纽约房市的预测', angle: '基于当前数据和趋势做3个预测，附上逻辑推理过程', keywords: ['市场预测', '房市走势', '行业观点'] },
            { id: 'p06', title: '买房最常后悔的5件事', angle: '从客户反馈总结：位置>面积、不该省验房钱、没谈好Contingency等', keywords: ['买房后悔', '买房经验', '避坑'] },
            { id: 'p07', title: '地产经纪人最怕你知道的秘密', angle: '用"揭秘"角度讲解行业内幕，建立信任感：佣金谈判、Dual Agency等', keywords: ['行业秘密', '佣金', '经纪人揭秘'] },
            { id: 'p08', title: '节日特辑：盘点今年房市大事件', angle: '年度/季度盘点，回顾重要政策、利率变化、市场转折点', keywords: ['年度盘点', '房市回顾', '市场总结'] },
        ],
    },
];

// ── Get topics for today (deterministic rotation) ───────────
export function getTodayTopics(module: ContentModule, dateStr: string): TopicItem[] {
    const dayNum = dateToDayNumber(dateStr);
    const pool = module.topics;
    const count = Math.min(module.topicsPerDay, pool.length);

    const startIdx = (dayNum * count) % pool.length;
    const selected: TopicItem[] = [];

    for (let i = 0; i < count; i++) {
        selected.push(pool[(startIdx + i) % pool.length]);
    }

    return selected;
}

function dateToDayNumber(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00Z');
    const epoch = new Date('2026-01-01T00:00:00Z');
    return Math.floor((d.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
}
