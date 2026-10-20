# 贡献一个人设

欢迎提交新的 persona。流程是 **fork → 改 → PR**，`main` 不接受直接推送。

## 步骤

1. Fork 本仓库并 clone 你的 fork。
2. 在 `personas/` 下新建 `<id>.md`：

   ```markdown
   ---
   id: my-persona
   name: 显示名
   description: 一句话说明这个人设是什么味道
   order: 30
   ---

   你是……（人设正文，直接写给模型看）
   ```

3. 运行同步与构建：

   ```bash
   node build.mjs --sync          # 更新仓库根 cordis.patch.yml
   node build.mjs --all --out dist/ci
   ```

4. 提交 `personas/<id>.md` **和** 更新后的 `cordis.patch.yml`，然后开 PR。
5. 等 `validate` 工作流通过、维护者合并。

## 规则

- **id**：小写字母、数字、连字符，全仓库唯一；`order` 不要和现有条目重复（建议从 30 起）。
- **一个人设一个 PR**，方便单独审阅和回滚。
- **正文是 system prompt**，第一句写「你是……」。建议 600–1500 字，太长会推高每次请求的 token。
- **不要包含真实个人信息**：真名、学校、公司、住址、联系方式、账号 ID 都不要。
- **不要逐字复制受版权保护的长篇原文**（小说、台词本、付费语料）。同人二创可以，整段搬运不行。
- **不要改 `lib/toolset.yml`**。它跟随 DSH 版本维护；需要新工具请在 PR 里说明理由。
- **不要手改 `cordis.patch.yml`**，它由 `build.mjs --sync` 生成；CI 会检查它是否与 `personas/` 一致。

## 授权

提交 PR 即表示你同意：

- 人设文本以 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 在本仓库发布；
- 代码与模板部分沿用仓库的 MIT 许可。

角色与世界观版权归原权利方，本仓库只做非商业同人分享。

## 审阅标准

维护者主要看三件事：像不像、有没有隐私、构建是否通过。风格不合可以讨论，但不会因为「不够像」直接拒收一个完整、干净的人设。
