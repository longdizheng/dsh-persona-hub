# dsh-persona-hub

一个可分享的 DeepSeek Harness **多 persona 组合包**。仓库里每个人设是一份
markdown，构建脚本把它们编成若干个 agent preset；安装后，新建会话时在预置
选择器里挑一个身份即可。

装全部、或只装挑中的几个都行——「装哪些」发生在构建这一步，不在安装之后。

## 两种安装方式

### A. 让 agent 问你（推荐）

把仓库地址丢给 DSH 的 agent，并让它读 [`AGENT-INSTALL.md`](AGENT-INSTALL.md)。
Agent 会先运行 `node build.mjs --list`，再用 `ask_user_question` 让你勾选
要安装的人设，然后只为选中的那些生成并安装组合包。

### B. 自己勾选

```bash
git clone https://github.com/longdizheng/dsh-persona-hub.git
cd dsh-persona-hub
node build.mjs            # 编号多选，all=全部，回车=取消
# 或非交互
node build.mjs --only alpha,selena
```

产物在 `dist/persona-pack/`。然后在 Harness 的**插件**页安装该目录，或让
agent 执行 `plugin_manager action=install_bundle target=<该目录绝对路径>`。

### C. 一键装全部

仓库根目录本身就是一个合法组合包（`cordis.patch.yml` 含全部人设）。在插件页
直接填仓库的 git 地址即可：

```
git+https://github.com/longdizheng/dsh-persona-hub.git
```

装完不会问你，四个 preset 全在，按会话选一个。

## 仓库结构

| 路径 | 作用 |
|---|---|
| `personas/*.md` | 人设正文 + frontmatter（id、name、description、order） |
| `lib/toolset.yml` | 每个 preset 共用的 DSH 标准工具行（不含 persona 行） |
| `build.mjs` | 读取人设、生成子集组合包；`--list` / `--only` / `--all` / `--sync` |
| `cordis.patch.yml` | 仓库根组合包的 patch，由 `--sync` 生成 |
| `AGENT-INSTALL.md` | 给 agent 的安装协议：必须先问用户选哪些 |

## 每个人设长什么样

每个 preset 都是 `@deepseek-ai/dsh-agent-preset` 的一条声明：

```yaml
- id: preset-persona-alpha
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: persona-alpha
    plugins:
      - id: persona
        name: '@deepseek-ai/dsh-persona'
        config:
          prefix: |-
            …人设正文…
      # 其余工具行来自 lib/toolset.yml
```

`persona` 行必须挂在 preset 里（agent scope）；挂到全局会与部署级人设撞槽位。
preset 没有继承机制，所以工具行要随包带上，`toolset.yml` 就是从 DSH 自带的
`standard` preset 抄下来的，固定于 `0.2.1-rc.2`。升级 DSH 后请重新同步。

## 新增一个人设

1. 在 `personas/` 下新建 `<id>.md`，写 frontmatter：

   ```
   ---
   id: my-persona
   name: 显示名
   description: 一句话说明
   order: 30
   ---
   ```

2. 正文就是人设 system prompt，直接写「你是……」。
3. 运行 `node build.mjs --sync` 更新仓库根 patch；再 `node build.mjs --list` 确认。

## 兼容性与升级

- 生成物声明 `engines.dsh = ">=0.2.1-rc.2"`；DSH 大版本变化后，先对照
  `presets/standard.patch.yml` 更新 `lib/toolset.yml`，再重新构建。
- 同一包名 + 同一版本重复安装会被判为已安装；换人设后请升 `--version` 或换
  `--name`。

## 版权

人设文本来自本仓库作者的二次创作，角色与世界观版权归《战双帕弥什》及其权利方，
仅供个人同人使用。代码与模板以 MIT 发布。
