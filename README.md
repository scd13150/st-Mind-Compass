<div align="center">

# 灵犀 (Mind Compass)
### Objective Mind Compass & Relationship Dynamics for SillyTavern

基于 TypeSafe Jev (System One) 原生云端 API 的客观心智裁决与情感动力学罗盘

[简体中文](#-简体中文) | [English](#-english)

</div>

---

# 🇨🇳 简体中文

## 🌟 核心特性

- 🛡️ **彻底破除"白给综合征" (Anti-Sycophancy)**：
  - 将大语言模型的"语言生成"与"心智裁决"彻底物理分离。
  - **廉价奉承自动过滤**：利用 Jev 原子语义传感器精准识别无脑吹捧，施加负向折扣，杜绝无意义好感膨胀。
- 📊 **确定性双轨动力学引擎 (Dual-Track Dynamics Engine)**：
  - **一阶低通惯性滤波 (Leaky Filter)**：维护瞬时微动量（Momentum），前序深度走心后接日常短句依然平滑温热，根除单帧情感断崖。
  - **洋葱模型核心信任 (Social Penetration)**：日常闲聊仅累积相处融洽度（Rapport），唯有深层脆弱性暴露可穿透心防护盾，杜绝挂机刷闲聊磨破心防。
  - **连续性格动力学调节**：支持角色奉承抗性、共鸣渴望度与初始心防连续调节，无死板分类预设，支持 Jev 智能推断。
  - **科学破关与消除死锁**：阶段门禁根据核心信任深度动态裁决，达标平滑放行，彻底消灭高傲角色的卡关死锁。
- 🔒 **免配置默认持久化与原生保险库兼容 (Universal Key Persistence)**：
  - 默认零配置持久化落盘至酒馆设置，跨浏览器重启、页面刷新自动秒级恢复。
  - 若开启酒馆 `allowKeysExposure: true`，亦会自动同步写入服务端原生密钥保险库。
  - 输入框支持脱敏掩码、显隐切换与一键清空。
- 🎭 **28 维 GoEmotions 差分立绘原生联动**：
  - 严格对齐 SillyTavern 原生 Character Expressions 规范（`joy`, `amusement`, `anger`, `caring`, `confusion`, `embarrassment`, `pride`, `relief`, `love` 等 28 维），自动通过 `/expression-set` 驱动差分表情。
- 📖 **中英双语世界书广播注入 (Bilingual World Info Injection)**：
  - 每轮自动向 Prompt 上下文广播注入多别名复合标签（例：`[MindCompass: 阶段=初见戒备 (Stranger/Guarded | 初见 | 陌生 | 戒备 | stranger | guarded | distant) | 好感度=10.0 Affinity=10.0 | 心防=95% Defense=95% | 信任=5% Trust=5% | 微表情=neutral | 气场=3.5]`）。
  - 原生触发世界书剧情条目，兼容社区现存所有中英文好感度世界书。
- 💾 **角色卡内生持久化 (In-Card Native Persistence)**：
  - 使用酒馆标准 `writeExtensionField` 将心智数据持久化写入角色卡 `char.data.extensions.mind_engine`。换会话自动继承进度。
- 🎛️ **冷调毛玻璃悬浮罗盘 (Floating Mind Compass HUD)**：
  - 38px 微型光核折叠态，展开可查看好感度、心防壁垒、核心信任深度与气场博弈刻度，视口边缘自动回弹钳位防溢出。
- 🚀 **原生零本地后端架构 (Zero-Backend Cloud Native)**：
  - 纯 ES Module 直连 TypeSafe Jev 官方 REST API，用户无需部署本地 Python、Node.js 服务或 Docker 容器。

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
2. 点击右上角闪烁的 **Install Extension**（安装扩展）按钮
3. 粘贴本仓库 GitHub 地址：
   ```
   https://github.com/scd13150/st-Mind-Compass
   ```
4. 点击 **Install**，安装完成后刷新页面即可。

### 方式二：手动安装

将本仓库 clone 或解压至 SillyTavern 插件目录：
```bash
# Windows / Linux / macOS
cd SillyTavern/data/default-user/extensions/
git clone https://github.com/scd13150/st-Mind-Compass.git
```
刷新 SillyTavern 页面即可。

---

## ⚙️ 配置与使用

1. 打开酒馆右侧抽屉 **Extensions Settings** -> **灵犀 (Mind Compass)**
2. 填入你的 [TypeSafe API Key](https://typesafe.ai)（格式如 `apikey_...`）
3. 点击 **测试连接**，指示灯变为翠绿且显示毫秒级延迟即表示就绪
4. 开始正常聊天，主视窗即会浮现冷调精密 HUD，实时呈现心智攻防

> **关于 API 密钥持久化**：
> - 插件默认已支持开箱即用的跨会话持久化保存，无需任何额外配置；
> - （可选进阶）如需启用 SillyTavern 服务端底层原生密钥保险库防护，可将酒馆根目录 `config.yaml` 中的 `allowKeysExposure: false` 修改为 `allowKeysExposure: true` 并重启酒馆服务。

---

# 🇬🇧 English

## 🌟 Key Features

- 🛡️ **Anti-Sycophancy Architecture**:
  - Physically decouples narrative generation from psychological evaluation.
  - **Automated Flattery Filtering**: Uses Jev atomic semantic sensors to detect shallow, unearned flattery and applies proportional discounts, preventing unrealistic affinity spikes.
- 📊 **Deterministic Dual-Track Dynamics Engine**:
  - **First-Order Low-Pass Inertial Filter (Leaky Filter)**: Retains emotional momentum across dialogue turns. Warmth from previous deep exchanges naturally lingers through casual short responses, eliminating abrupt emotional cliffs.
  - **Social Penetration (Onion Model)**: Casual small talk builds rapport without breaching deep defensive walls. Only genuine vulnerability exposure penetrates core defense barriers.
  - **Continuous Personality Spectrum**: Continuous parameter tuning for flattery resistance, resonance sensitivity, and baseline defense. No rigid archetypes, fully compatible with Jev automated trait inference.
  - **Empirical Threshold Unlocking**: Stage progression gates evaluate against core trust depth, eliminating deadlock states for guarded or aloof characters.
- 🔒 **Zero-Config Persistence & Native Vault Support**:
  - Out-of-the-box persistent storage in extension settings, surviving browser restarts and page refreshes without manual configuration.
  - Automatically synchronizes with SillyTavern native server secrets vault if `allowKeysExposure: true` is enabled.
  - Password input with masking, visibility toggling, and one-click removal.
- 🎭 **28-Dimension GoEmotions Sprite Integration**:
  - Fully aligned with SillyTavern Character Expressions (`joy`, `amusement`, `anger`, `caring`, `confusion`, `embarrassment`, `pride`, `relief`, `love`, etc.), driving automatic sprite swaps via `/expression-set`.
- 📖 **Bilingual World Info Injection**:
  - Periodically broadcasts comprehensive multi-alias state tags into prompt context (`[MindCompass: 阶段=初见戒备 (Stranger/Guarded | 初见 | 陌生 | 戒备 | stranger | guarded | distant) | 好感度=10.0 Affinity=10.0 | 心防=95% Defense=95% | 信任=5% Trust=5% | 微表情=neutral | 气场=3.5]`), natively triggering lorebooks in both Chinese and English.
- 💾 **In-Card Native Persistence**:
  - Uses SillyTavern standard `writeExtensionField` to persist relationship and personality states inside `char.data.extensions.mind_engine`. Automatically retained across chats.
- 🎛️ **Floating Glassmorphism HUD**:
  - Minimalist 38px collapsed micro-capsule expanding into a 4-track tactical HUD displaying affinity, defense wall, trust depth, and conversational dominance, with automatic viewport edge clamping.
- 🚀 **Zero-Backend Cloud Native**:
  - Pure ES Module connecting directly to TypeSafe Jev REST API. Requires no local Python environments, Node.js background daemons, or Docker containers.

---

## 📦 Installation

### Option 1: SillyTavern UI Install (Recommended)

1. Open SillyTavern and click **Extensions** (stacked cubes icon in top navigation).
2. Click the flashing **Install Extension** button in the top right corner.
3. Paste the GitHub repository URL:
   ```
   https://github.com/scd13150/st-Mind-Compass
   ```
4. Click **Install**, then refresh the browser page.

### Option 2: Manual Clone

Clone or extract into the SillyTavern extensions directory:
```bash
# Windows / Linux / macOS
cd SillyTavern/data/default-user/extensions/
git clone https://github.com/scd13150/st-Mind-Compass.git
```
Restart or refresh SillyTavern.

---

## ⚙️ Configuration

1. In SillyTavern, open right drawer **Extensions Settings** -> **灵犀 (Mind Compass)**.
2. Enter your [TypeSafe API Key](https://typesafe.ai) (format: `apikey_...`).
3. Click **Test Connection** (测试连接). The status dot turns emerald green with response latency displayed in milliseconds.
4. Begin chatting. The precision HUD will float onto the screen to monitor dynamic psychological shifts in real time.

> **API Key Persistence Note**:
> - Key persistence is enabled by default with zero configuration required;
> - (Optional Advanced) To use SillyTavern native server secrets isolation, set `allowKeysExposure: true` in your SillyTavern root `config.yaml` and restart the server.

---

## 📜 License

Distributed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).
