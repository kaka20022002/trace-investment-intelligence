import type { Evidence, InvestmentEvent, Store } from "./model";

export function createSeed(now = Date.now()): Store {
  const at = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const events: InvestmentEvent[] = [
    {
      id: "event-1",
      title: "远川智造第三季度业绩预告出现口径分歧",
      company: "远川智造",
      ticker: "SIM·003",
      category: "业绩披露",
      topic: "2026年第三季度净利润",
      tags: ["口径待核对", "智能制造"],
      createdAt: at(74),
    },
    {
      id: "event-2",
      title: "澜芯科技收购砺行半导体传闻获正式回应",
      company: "澜芯科技",
      ticker: "SIM·001",
      category: "并购重组",
      topic: "收购砺行半导体股权",
      tags: ["半导体", "公司澄清"],
      createdAt: at(70),
    },
    {
      id: "event-3",
      title: "星屿能源 20GWh 储能项目签约落地",
      company: "星屿能源",
      ticker: "SIM·002",
      category: "扩产投建",
      topic: "20GWh储能项目",
      tags: ["储能", "产能建设"],
      createdAt: at(100),
    },
    {
      id: "event-4",
      title: "青禾医药新型检测产品进入验证阶段",
      company: "青禾医药",
      ticker: "SIM·004",
      category: "产品进展",
      topic: "新型检测产品验证",
      tags: ["医疗器械", "产品验证"],
      createdAt: at(60),
    },
    {
      id: "event-5",
      title: "泊云软件与下游客户签订年度服务协议",
      company: "泊云软件",
      ticker: "SIM·005",
      category: "订单合作",
      topic: "年度服务协议",
      tags: ["企业服务", "订单跟踪"],
      createdAt: at(50),
    },
    {
      id: "event-6",
      title: "闻溪消费股份回购计划等待后续披露",
      company: "闻溪消费",
      ticker: "SIM·006",
      category: "回购增持",
      topic: "股份回购计划",
      tags: ["回购", "信息过期"],
      createdAt: at(200),
    },
  ];
  const evidence: Evidence[] = [];
  const add = (
    eventId: string,
    id: string,
    hours: number,
    sourceType: Evidence["sourceType"],
    source: string,
    kind: Evidence["kind"],
    action: Evidence["action"],
    content: string,
    extras: Partial<Evidence> = {},
  ) => {
    evidence.push({
      id,
      eventId,
      title: content.split("。")[0].slice(0, 100),
      source: `${source}（模拟）`,
      sourceType,
      sourceUrl: "",
      content,
      quote: content.split("。")[0],
      kind,
      action,
      occurredAt: at(hours + 2),
      publishedAt: at(hours),
      fetchedAt: at(hours - 0.1),
      updatedAt: at(hours - 0.1),
      expiresAt: at(-168),
      supersedes: null,
      originId: `${eventId}-${source}`,
      verified: sourceType === "公司公告" || sourceType === "财经媒体",
      demo: true,
      ...extras,
    });
  };
  add(
    "event-1",
    "ev-11",
    72,
    "公司公告",
    "远川智造公告",
    "事实",
    "支持",
    "远川智造披露：2026年第三季度归属于母公司股东的净利润预计为1,800万至2,200万元，同比增加20%至46.7%。口径为单季度、人民币、未经审计，区间以原文为准。",
  );
  add(
    "event-1",
    "ev-12",
    20,
    "机构研报",
    "晨曦研究",
    "观点",
    "支持",
    "晨曦研究认为，远川智造产品结构调整可能带来经营效率改善。此为研究观点，不构成已实现的业绩事实，也不包含投资建议。",
  );
  add(
    "event-1",
    "ev-13",
    0.8,
    "财经媒体",
    "商业观察",
    "事实",
    "否认",
    "商业观察报道：远川智造财务部门回应，单季度净利润1,800万至2,200万元的说法不准确，该区间对应前三季度累计口径。报道附访谈摘录，但与公司已披露公告口径冲突，仍待公司正式更正。",
  );
  add(
    "event-2",
    "ev-21",
    68,
    "社交平台",
    "行业讨论帖",
    "传闻",
    "支持",
    "网传澜芯科技拟收购砺行半导体51%股权，交易价格尚未确定。帖子没有附公告或可核验的一手材料。",
    { occurredAt: null, verified: false },
  );
  add(
    "event-2",
    "ev-22",
    48,
    "财经媒体",
    "产业快讯",
    "传闻",
    "支持",
    "产业快讯转述行业讨论帖：澜芯科技可能收购砺行半导体股权。该报道未提供新增证据，不能作为独立信息源。",
    { originId: "event-2-行业讨论帖", verified: false, occurredAt: null },
  );
  add(
    "event-2",
    "ev-23",
    4,
    "公司公告",
    "澜芯科技公告",
    "事实",
    "否认",
    "澜芯科技公告：截至披露日，公司未签署收购砺行半导体股权的协议，相关传闻不属实。公司不存在应披露而未披露的相关交易事项。",
  );
  add(
    "event-3",
    "ev-31",
    98,
    "财经媒体",
    "产业周刊",
    "推测",
    "支持",
    "产业周刊报道，星屿能源可能建设20GWh储能项目，投资规模预计为50亿元。该金额为采访中的初步测算，尚非公司公告确认值。",
    { verified: false },
  );
  add(
    "event-3",
    "ev-32",
    30,
    "公司公告",
    "星屿能源公告",
    "事实",
    "支持",
    "星屿能源已签署20GWh储能项目投资意向协议，计划总投资45亿元，分两期建设。币种为人民币，金额为规划总额，不等于已投入资金，项目仍需履行审批程序。",
  );
  add(
    "event-3",
    "ev-33",
    6,
    "机构研报",
    "青山研究",
    "观点",
    "支持",
    "青山研究认为，星屿能源20GWh储能项目有助于补充产品布局。项目收入贡献仍取决于建设进度及需求情况，此为观点而非事实。",
  );
  add(
    "event-4",
    "ev-41",
    58,
    "社交平台",
    "产品交流社区",
    "传闻",
    "支持",
    "网传青禾医药新型检测产品已完成全部验证。信息来自匿名帖子，暂未找到公开一手材料。",
    { verified: false, occurredAt: null },
  );
  add(
    "event-4",
    "ev-42",
    8,
    "机构研报",
    "健康产业研究",
    "推测",
    "支持",
    "研究机构推测青禾医药新型检测产品或将在年内完成验证。尚无公司公告确认具体进度，验证完成不等于取得许可。",
    { verified: false },
  );
  add(
    "event-5",
    "ev-51",
    47,
    "公司公告",
    "泊云软件公告",
    "事实",
    "支持",
    "泊云软件披露，已与匿名企业客户签订年度服务协议，合同含税金额3,000万元。币种人民币，服务期12个月，收入确认需按履约进度进行。",
  );
  add(
    "event-5",
    "ev-52",
    12,
    "公司公告",
    "泊云软件公告",
    "事实",
    "更正",
    "泊云软件更正公告：年度服务协议的含税金额应为2,800万元，前次公告3,000万元系录入错误。币种人民币，服务期12个月，其他约定未变。",
    { supersedes: "ev-51" },
  );
  add(
    "event-6",
    "ev-61",
    190,
    "财经媒体",
    "消费观察",
    "推测",
    "支持",
    "消费观察推测闻溪消费或推出股份回购计划，窗口期为未来一周。未见公司确认；本材料仅在所述观察窗口内有效。",
    { verified: false, expiresAt: at(22) },
  );
  return {
    version: 1,
    events,
    evidence,
    watchlist: ["event-1", "event-2", "event-3"],
  };
}

export const importExample =
  "澜芯科技更新公告：公司已与砺行半导体签署股权收购意向书，拟收购51%股权，价格尚在协商中。本公告更正此前未签署相关协议的表述，意向书不代表交易完成，最终方案仍存在不确定性。";
