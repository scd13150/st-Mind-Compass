# 灵犀 (Mind Compass) - 酒馆客观心智与羁绊动力学罗盘

<p align="center">
  <b>基于 TypeSafe Jev (System One) 原生云端 API 的客观心智裁决与情感动力学罗盘</b><br>
  <i>原生酒馆UI风格 · 中英自适应双语 · 酒馆原生密钥保险库防护 · 28 维 GoEmotions 立绘切换 · 洋葱模型核心信任 · 惯性微动量阻尼</i>
</p>

---

## 🌟 核心特性

- 🔒 **酒馆原生 API 密钥保险库防护 (Native Secret Vault Protection)**：
  - 严格遵守 SillyTavern 凭据安全规范，调用 `/api/secrets` 隔离落盘于服务端的 `secrets.json`。
  - **彻底杜绝明文写入 `settings.json` 或随角色卡导出泄露**。
  - 前端输入框强制接入酒馆原生 `.text_pole`，提供脱敏掩码（`apikey_••••••••xxxx`）、显隐切换与一键清空机制。
- 🌐 **自适应中英双语 (Adaptive Bilingual i18n)**：
  - 自动感知酒馆当前语言环境（`i18next` / `user_settings` / `navigator`），抽屉设置、HUD 指标刻度、浮动跳字与通知弹窗全流程无缝自动切换。
- 🎨 **酒馆原生 UI 深度融入 (Native Theme Styling)**：
  - 全面接管酒馆 `--SmartThemeQuoteColor`, `--SmartThemeBorderColor`, `--SmartThemeBodyColor` 等 CSS 变量。
  - 按钮与输入框全面复用酒馆官方 `.text_pole`、`.menu_button` 与 FontAwesome 6 图标，消除任何外挂视觉违和感。
- 🚀 **原生零本地后端架构 (Zero-Backend Cloud Native)**：
  - 基于浏览器端纯 ES Module 直接对接 TypeSafe Jev 官方 REST API，用户**无需在本地安装任何 Python、Node.js 服务或 Docker 容器**。在扩展面板填入 API Key 即可即装即用。
- 🛡️ **彻底破除"白给综合征" (Anti-Sycophancy)**：
  - 将大语言模型的"语言生成"与"心智裁决"彻底物理分离。
  - **廉价奉承自动过滤**：利用 Jev 原子语义传感器精准识别无脑吹捧，施加负向折扣，杜绝无意义好感膨胀。
- 📊 **确定性双轨动力学引擎 (Dual-Track Dynamics Engine)**：
  - **一阶低通惯性滤波 (Leaky Filter)**：维护瞬时微动量（Momentum），前序深度走心后接日常短句依然平滑温热，根除单帧情感断崖。
  - **洋葱模型核心信任 (Social Penetration)**：日常闲聊仅累积相处融洽度（Rapport），唯有深层脆弱性暴露可穿透心防护盾，杜绝挂机刷闲聊磨破心防。
  - **科学破关与消除死锁**：阶段门禁根据核心信任深度动态裁决，达标平滑放行，彻底消灭高傲角色的卡关死锁。
- 🎭 **28 维 GoEmotions 差分立绘原生联动**：
  - 严格对齐 SillyTavern 原生 Character Expressions 规范（`joy`, `amusement`, `admiration`, `anger`, `caring`, `confusion`, `desire`, `embarrassment`, `pride`, `relief`, `love` 等 28 维），自动通过 `/expression-set` 驱动差分表情。
- 📖 **中英双语世界书广播注入 (Bilingual World Info Injection)**：
  - 每轮自动向 Prompt 上下文广播注入多别名复合标签（例：`[MindCompass: 阶段=初见戒备 (Stranger/Guarded | 初见 | 陌生 | 戒备 | stranger | guarded | distant) | 好感度=10.0 Affinity=10.0 | 心防=95% Defense=95% | 信任=5% Trust=5% | 微表情=neutral | 气场=3.5]`）。
  - SillyTavern 原生世界书扫描器会自动识别并触发相应世界书条目，无缝兼容社区现存所有中英文好感度世界书。
- 💾 **角色卡内生持久化 (In-Card Native Persistence)**：
  - 使用酒馆标准 `writeExtensionField` 将心智数据持久化写入角色卡 `char.data.extensions.mind_engine`。跨会话、新开会话均自动继承进度。
- 🎛️ **4 轨冷调毛玻璃悬浮罗盘 (Floating Mind Compass HUD)**：
  - 自研防抖自由拖拽与单击折叠状态机，38px 微型罗盘光核折叠态，丝滑展开显示好感度、心防壁垒、核心信任深度与气场博弈。

---

## 🏗️ 架构对比

```
传统好感度插件 (容易白给 / 算术幻觉):
[用户发话] ──> [LLM 一边角色扮演一边脑补好感] ──> [角色光速沦陷，好感虚高]

Tavern Mind Engine v2.0 (双脑 + 双轨架构):
[用户发话] ──> [酒馆主力大模型 (专注于文学色彩与角色扮演)] ──> [角色回复]
                    │
                    ▼ (异步监听)
        [TypeSafe Jev System One 官方 REST API]
                    │ (6 维原子正交并发扇出，单次 ~100ms)
        ├── 越界与雷区侵犯: boundary_violation (Noul)
        ├── 廉价无脑奉承:   superficial_flattery (Noul)
        ├── 社交机智融洽:   conversational_wit (Noul)
        ├── 共情理解接纳:   emotional_validation (Noul)
        ├── 脆弱共鸣暴露:   vulnerability_exposure (Noul)
        ├── 真实微表情:     inner_expression (28 维 GoEmotions)
        └── 气场支配权:     power_dynamic (Score 0~4)
                    │
                    ▼ (前端确定性动力学)
        [纯前端双轨动力学引擎 (复合评分 / 低通惯性滤波 / 洋葱信任穿透)]
                    │
                    ├──> [酒馆变量 {{affinity}}, {{relationship_stage}}, {{trust_depth}}, {{defense_prob}}]
                    ├──> [立绘切换 /expression-set]
                    ├──> [世界书自动触发 /inject]
                    └──> [角色卡写盘 writeExtensionField]
```

---

## 📦 安装方法

### 方式一：酒馆界面一键安装（推荐）

1. 打开 SillyTavern，点击顶部菜单栏的 **Extensions**（三叠方块图标）
2. 点击 **Install Extension**
3. 粘贴本仓库 GitHub 地址：
   ```
   https://github.com/your-username/tavern-mind-engine
   ```
4. 点击 **Install**，安装完成后刷新页面即可。

### 方式二：手动安装

将本仓库直接 clone 或解压至 SillyTavern 插件目录：
```bash
# Windows / Linux / macOS
cd SillyTavern/public/scripts/extensions/third-party/
git clone https://github.com/your-username/tavern-mind-engine.git
```
启动或刷新 SillyTavern 即可。

---

## ⚙️ 配置与使用

1. 打开酒馆右侧抽屉 **Extensions Settings** -> **Jev 心智判定引擎 (Tavern Mind Engine)**
2. 填入你的 [TypeSafe API Key](https://typesafe.ai)（格式如 `apikey_...`）
3. 点击 **测试连接**，指示灯变为翠绿且显示毫秒级延迟即表示就绪
4. 开始正常聊天，主视窗即会浮现冷调精密 HUD，实时呈现心智攻防！

---

## 📜 许可证

本项目遵循 [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE)。
