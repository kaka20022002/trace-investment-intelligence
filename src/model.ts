import { z } from "zod";

export const categories = [
  "并购重组",
  "扩产投建",
  "业绩披露",
  "订单合作",
  "产品进展",
  "回购增持",
] as const;
export const sourceTypes = [
  "公司公告",
  "机构研报",
  "财经媒体",
  "社交平台",
] as const;
export const kinds = ["事实", "观点", "推测", "传闻"] as const;
export const actions = ["支持", "否认", "更正", "更新"] as const;
export type Status = "已证实" | "证据冲突" | "已否认" | "待核实" | "已过期";
const datetime = z.string().datetime({ offset: true });
export const safeUrl = (value: string) => {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
export const EventSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(2).max(160),
  company: z.string().min(2).max(60),
  ticker: z.string().max(30),
  category: z.enum(categories),
  topic: z.string().min(2).max(80),
  tags: z.array(z.string().max(30)).max(10),
  createdAt: datetime,
});
export const EvidenceSchema = z.object({
  id: z.string().min(1).max(120),
  eventId: z.string().min(1).max(120),
  source: z.string().min(1).max(100),
  sourceType: z.enum(sourceTypes),
  sourceUrl: z
    .string()
    .max(2000)
    .refine((v) => !v || safeUrl(v), "仅允许 http/https 来源链接"),
  title: z.string().min(2).max(160),
  content: z.string().min(10).max(20000),
  quote: z.string().min(2).max(2000),
  kind: z.enum(kinds),
  action: z.enum(actions),
  occurredAt: datetime.nullable(),
  publishedAt: datetime,
  fetchedAt: datetime,
  updatedAt: datetime,
  expiresAt: datetime.nullable(),
  supersedes: z.string().nullable(),
  originId: z.string().min(1).max(200),
  verified: z.boolean(),
  demo: z.boolean(),
});
export const StoreSchema = z.object({
  version: z.literal(1),
  events: z.array(EventSchema).max(500),
  evidence: z.array(EvidenceSchema).max(5000),
  watchlist: z.array(z.string()).max(500),
});
export type InvestmentEvent = z.infer<typeof EventSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Store = z.infer<typeof StoreSchema>;
export type Conclusion = {
  status: Status;
  summary: string;
  references: string[];
  active: Evidence[];
  expired: string[];
  superseded: string[];
  weight: number;
  independent: number;
  warnings: string[];
};
export const ExtractionSchema = z.object({
  company: z.string().min(2).max(60),
  title: z.string().min(2).max(160),
  category: z.enum(categories),
  topic: z.string().min(2).max(80),
  kind: z.enum(kinds),
  action: z.enum(actions),
  quote: z.string().min(2).max(2000),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
