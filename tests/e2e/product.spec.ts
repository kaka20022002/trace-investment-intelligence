import { test, expect, type Page } from "@playwright/test";

async function nav(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "打开导航" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: label, exact: false })
    .filter({ visible: true })
    .first()
    .click();
}
async function sampleReview(page: Page) {
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page.getByRole("button", { name: "填入演示案例" }).click();
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await expect(page.getByText("选择事件归属")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { mode: "rules", configured: false } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "看清变化，回到证据。" }),
  ).toBeVisible();
});

test("工作台渲染、状态筛选与真实统计", async ({ page }, info) => {
  await expect(page.locator(".event-card")).toHaveCount(6);
  await expect(page.locator(".stat-card").first()).toContainText("06");
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "证据冲突", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator(".event-title")).toContainText("远川智造");
  await page.getByRole("button", { name: "已证实", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(2);
});

test("搜索、类型过滤、空结果与清除", async ({ page }) => {
  await page.getByRole("textbox", { name: "搜索事件或标的" }).fill("澜芯");
  await expect(page.locator(".event-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "搜索事件或标的" })
    .fill("不存在的公司");
  await expect(
    page.getByRole("heading", { name: "还没有符合条件的事件" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await page.getByLabel("事件类型筛选").selectOption("扩产投建");
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator(".event-title")).toContainText("星屿能源");
});

test("时间线、引用原文、四类时间与证据对照", async ({ page }) => {
  await page.locator(".event-title").filter({ hasText: "远川智造" }).click();
  await expect(page.locator(".conclusion-card")).toContainText("证据冲突");
  await expect(page.locator(".timeline-item")).toHaveCount(3);
  await page.getByRole("button", { name: "证据 1", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "原始证据" });
  await expect(drawer.getByText("完整原文", { exact: true })).toBeVisible();
  for (const time of ["事件发生", "信息披露", "系统抓取", "最后更新"])
    await expect(drawer.getByText(time, { exact: true })).toBeVisible();
  await expect(drawer.getByText("虚构示例", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "证据对照", exact: true }).click();
  await expect(page.locator(".comparison tbody tr")).toHaveCount(3);
});

test("主链路：提取、归并、更正、结论变化、刷新持久化、重复阻止", async ({
  page,
}) => {
  await sampleReview(page);
  await expect(page.getByLabel("证据作用")).toHaveValue("更正");
  await page.getByLabel("明确替代的前版本").selectOption("ev-23");
  await page.getByRole("button", { name: "确认归并并更新" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".conclusion-card")).toContainText("已证实");
  await expect(page.locator(".conclusion-card")).toContainText("意向书");
  await expect(page.locator(".timeline-item")).toHaveCount(4);
  await expect(
    page.locator(".timeline-card").filter({ hasText: "已被替代" }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".conclusion-card")).toContainText("已证实");
  await page.getByRole("button", { name: "返回情报工作台" }).click();
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page.getByRole("button", { name: "填入演示案例" }).click();
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await expect(page.getByRole("alert")).toContainText("原文已在证据库");
});

test("不选择前版本时冲突保留，不盲目覆盖", async ({ page }) => {
  await sampleReview(page);
  await page.getByRole("button", { name: "确认归并并更新" }).click();
  await expect(page.locator(".conclusion-card")).toContainText("证据冲突");
});

test("未核验新来源保持待核实，缺失发生时间可见", async ({ page }) => {
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page
    .getByLabel("情报原文")
    .fill(
      "云杉科技公告：公司已完成新型传感器产品的样机测试，目前处于后续验证阶段。",
    );
  await page.getByLabel("来源名称").fill("云杉科技公告");
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await page.getByRole("button", { name: "确认归并并更新" }).click();
  await expect(page.locator(".conclusion-card")).toContainText("待核实");
  await expect(page.locator(".conclusion-card")).toContainText(
    "发生时间未披露",
  );
  await expect(page.locator(".conclusion-card")).toContainText("缺少原文链接");
});

test("原文不足与未来时间不能导入", async ({ page }) => {
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await expect(page.getByRole("alert")).toContainText("至少输入");
  await page.getByRole("button", { name: "填入演示案例" }).click();
  await page.getByLabel("披露时间").fill("2099-12-31T12:00");
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await expect(page.getByRole("alert")).toContainText("不能位于未来");
});

test("模型调用失败明确回退，不伪装AI成功", async ({ page }) => {
  await page.unroute("**/api/health");
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { mode: "model", model: "test-model" } }),
  );
  await page.route("**/api/analyze", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  await page.reload();
  await sampleReview(page);
  await expect(
    page.getByText("模型接口不可用或结果未通过校验，已明确回退到本地规则。", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("本地规则提取", { exact: true })).toBeVisible();
});

test("关注切换并跨刷新保存", async ({ page }) => {
  await page.getByRole("button", { name: "关注青禾医药", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "取消关注青禾医药", exact: true }),
  ).toBeVisible();
  await nav(page, "我的关注");
  await expect(page.locator(".event-card")).toHaveCount(4);
  await expect(
    page.locator(".event-title").filter({ hasText: "青禾医药" }),
  ).toBeVisible();
});

test("证据库可筛选并追溯原文", async ({ page }) => {
  await nav(page, "证据资料库");
  await page.getByLabel("证据属性筛选").selectOption("传闻");
  await expect(page.locator(".library-table tbody tr")).toHaveCount(3);
  await page.locator(".library-title").first().click();
  await expect(page.getByRole("dialog", { name: "原始证据" })).toBeVisible();
});

test("导出简报与JSON备份，损坏备份不能覆盖", async ({ page }) => {
  const briefPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出简报", exact: true }).click();
  expect((await briefPromise).suggestedFilename()).toMatch(
    /trace-brief.*\.md$/,
  );
  await nav(page, "数据与设置");
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  expect((await backupPromise).suggestedFilename()).toMatch(
    /trace-backup.*\.json$/,
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1,"events":[]}'),
    });
  await expect(page.getByRole("alert")).toContainText("校验失败");
  await expect(page.locator(".backup-stats")).toContainText("14");
});

test("小屏无横向溢出，模态框支持Escape关闭", async ({ page }) => {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("不同来源链不能被表单静默改为同源更正", async ({ page }) => {
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page.getByRole("button", { name: "填入演示案例" }).click();
  await page.getByLabel("原始来源链标识").fill("independent-interview-B");
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await page.getByLabel("明确替代的前版本").selectOption("ev-23");
  await page.getByRole("button", { name: "确认归并并更新" }).click();
  await expect(page.getByRole("alert")).toContainText("相同原始来源链");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("否定性的更正不会错误确认已签约", async ({ page }) => {
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page.getByRole("button", { name: "填入演示案例" }).click();
  await page
    .getByLabel("情报原文")
    .fill(
      "泊云软件更正公告：公司未签署年度服务协议，此前关于已签约的公告表述不属实。",
    );
  await page.getByLabel("来源名称").fill("泊云软件公告（模拟）");
  await page.getByLabel("原始来源链标识").fill("event-5-泊云软件公告");
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await expect(page.getByLabel("证据作用")).toHaveValue("否认");
  await page.getByLabel("证据作用").selectOption("更正");
  await page.getByLabel("明确替代的前版本").selectOption("ev-52");
  await page.getByRole("button", { name: "确认归并并更新" }).click();
  await expect(page.locator(".conclusion-card")).toContainText("已否认");
});

test("幻觉引用回退后真正恢复本地提取字段", async ({ page }) => {
  await page.unroute("**/api/health");
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { mode: "model", model: "test-model" } }),
  );
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        extraction: {
          company: "错误模型公司",
          title: "错误模型事件",
          category: "并购重组",
          topic: "无关收购事项",
          kind: "事实",
          action: "支持",
          quote: "这段引用完全不在用户原文中",
        },
      },
    }),
  );
  await page.reload();
  await sampleReview(page);
  await expect(
    page.getByText("模型接口不可用或结果未通过校验，已明确回退到本地规则。", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("事件主体")).toHaveValue("澜芯科技");
  await expect(page.getByLabel("可追溯引用")).not.toHaveValue(
    "这段引用完全不在用户原文中",
  );
});

test("两个标签页不能静默覆盖对方新记录", async ({ page, context }) => {
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator(".event-card")).toHaveCount(6);
  await page.getByRole("button", { name: "关注青禾医药", exact: true }).click();
  await expect(second.getByRole("alert")).toContainText("其他标签页已更新记录");
  await second
    .getByRole("button", { name: "关注泊云软件", exact: true })
    .click();
  const watches = await second.evaluate(
    () => JSON.parse(localStorage.getItem("trace-investment-v1")!).watchlist,
  );
  expect(watches).toContain("event-4");
  expect(watches).not.toContain("event-5");
  await second.reload();
  await expect(
    second.getByRole("button", { name: "取消关注青禾医药", exact: true }),
  ).toBeVisible();
  await second.close();
});

test("容量边界阻止创建不可恢复的第501个事件", async ({ page }) => {
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("trace-investment-v1")!);
    const template = data.events[0];
    data.events.push(
      ...Array.from({ length: 494 }, (_, i) => ({
        ...template,
        id: `capacity-${i}`,
        company: `容量测试${i}`,
        title: `容量事件${i}`,
      })),
    );
    localStorage.setItem("trace-investment-v1", JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole("button", { name: "导入情报", exact: true }).click();
  await page
    .getByLabel("情报原文")
    .fill(
      "容量新科技公告：公司已经完成新型传感器样机验证，并发布相应技术说明。",
    );
  await page.getByLabel("来源名称").fill("容量新科技公告");
  await page.getByRole("button", { name: "提取并匹配事件" }).click();
  await page.getByRole("button", { name: "确认归并并更新" }).click();
  await expect(page.getByRole("alert")).toContainText("容量上限");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("trace-investment-v1")!).events.length,
    ),
  ).toBe(500);
});
