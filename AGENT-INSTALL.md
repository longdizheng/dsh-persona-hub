# 安装协议（给 DSH agent）

本仓库是「多 persona 组合包」。**安装时不要替用户决定装哪些**：先问，再只装
选中的。下面是完整流程。

## 1. 确认路径

`AGENT-INSTALL.md` 所在目录即仓库根，记作 `<repo>`。后续命令都在这里跑。

## 2. 读出可选人设

```bash
node build.mjs --list
```

输出 JSON 数组，每项有 `id`、`name`、`description`、`order`。不要自己编造
人设，也不要默认全选。

## 3. 询问用户

调用 `ask_user_question`，**一次问题、多选**：

- `question`：`要安装哪些 persona？`
- `options`：每个候选一项，`label` 用 `name`，`description` 用 `description`
- `multi_select: true`

等用户回答。用户说「全部」才等价于 `--all`；用户取消就停止，不要安装。

## 4. 生成子集

```bash
node build.mjs --only <id1,id2,...> --out "<repo>/dist/persona-pack"
```

产物是 `dist/persona-pack/` 下的 `package.json`、`cordis.patch.yml`、`README.md`。

## 5. 安装

```bash
plugin_manager action=install_bundle target="<repo>/dist/persona-pack"
```

需要 `danger-full-access` 或用户当场批准。以返回的 `application` 与
`warnings` 判断是否生效，不要拿日志或页面状态替代。

## 6. 收尾

- 告诉用户装了哪几个 preset（`persona-<id>`），以及**新建会话**后在预置选择器
  里选。
- 已有会话保留启动时的组合，不会自动切换。
- 如果安装返回 `already-installed`：换版本重生成（`--version 1.0.1`）再装。
- 如果返回 `restart-required`：说明要重启 Harness 后才生效。
- 不要声称已做视觉验证；没有实际新开会话就算未验证。

## 禁止

- 不要直接安装仓库根目录，除非用户明确说「全部」——根目录是四合一。
- 不要手改 `cordis.patch.yml` 或 `lib/toolset.yml`；改人设请改
  `personas/*.md`，改工具请说明理由并重新同步。
- 不要在未询问的情况下推测用户喜欢哪个角色。
