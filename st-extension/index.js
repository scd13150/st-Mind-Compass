import { eventSource, event_types, saveSettingsDebounced, getRequestHeaders } from '/script.js';
import { getContext, writeExtensionField, extension_settings } from '/scripts/extensions.js';
import { JevEvaluator } from './evaluator.js';
import { AffinityDynamicsEngine, getStage, getStageAliases } from './dynamics.js';

const MODULE_NAME = 'tavern-mind-engine';
const FETCH_TIMEOUT_MS = 20000;
const SECRET_KEY_ID = 'typesafe_api_key';

let isEvaluating = false;
let lastEvaluatedMessageId = null;
let hasWarnedMissingKey = false;
let inMemoryApiKey = '';
let isKeyRevealed = false;
let lastFocusedMacroInputId = 'mind_macro_affinity_input';

// 默认用户配置
const DEFAULT_SETTINGS = {
    enableHud: true,
    enableExpressions: true,
    enableInjection: true,
    enablePersistence: true,
    macroBindings: {},
};

/**
 * 安全获取酒馆鉴权请求头
 */
function safeGetRequestHeaders() {
    try {
        if (typeof getRequestHeaders === 'function') {
            return getRequestHeaders();
        }
    } catch (_) {}
    return {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };
}

/**
 * ============================================================================
 * 酒馆原生密钥保险库管理器 (Native Secret Vault Protection)
 * ============================================================================
 */
class SecretVaultManager {
    static async getApiKey() {
        if (inMemoryApiKey) return inMemoryApiKey;

        // 1. 优先从 extension_settings 持久化读取（默认模式，跨浏览器刷新/关闭自动恢复，无需配置 yaml）
        const settings = extension_settings.mind_engine;
        if (settings && settings.apiKey) {
            inMemoryApiKey = settings.apiKey.trim();
            return inMemoryApiKey;
        }

        // 2. 检查会话临时存储 sessionStorage (当前标签页快速兜底)
        try {
            const sessionVal = sessionStorage.getItem(SECRET_KEY_ID);
            if (sessionVal) {
                inMemoryApiKey = sessionVal.trim();
                return inMemoryApiKey;
            }
        } catch (_) {}

        // 3. 尝试从酒馆原生服务端保险库读取（若用户开启了 allowKeysExposure: true）
        try {
            const resp = await fetch('/api/secrets/find', {
                method: 'POST',
                headers: safeGetRequestHeaders(),
                body: JSON.stringify({ key: SECRET_KEY_ID }),
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.value) {
                    inMemoryApiKey = data.value.trim();
                    return inMemoryApiKey;
                }
            }
        } catch (_) {}

        return '';
    }

    static async saveApiKey(key) {
        inMemoryApiKey = key ? key.trim() : '';

        // 1. 持久化写入 extension_settings（默认模式，落盘 settings.json，跨会话自动保留）
        if (!extension_settings.mind_engine) extension_settings.mind_engine = {};
        if (inMemoryApiKey) {
            extension_settings.mind_engine.apiKey = inMemoryApiKey;
        } else {
            delete extension_settings.mind_engine.apiKey;
        }
        saveSettingsDebounced();

        // 2. 写入 sessionStorage
        try {
            if (inMemoryApiKey) {
                sessionStorage.setItem(SECRET_KEY_ID, inMemoryApiKey);
            } else {
                sessionStorage.removeItem(SECRET_KEY_ID);
            }
        } catch (_) {}

        // 3. 同步尝试写入服务端保险库（若用户配置了 allowKeysExposure 可双向同步）
        try {
            await fetch('/api/secrets/write', {
                method: 'POST',
                headers: safeGetRequestHeaders(),
                body: JSON.stringify({ key: SECRET_KEY_ID, value: inMemoryApiKey }),
            });
        } catch (_) {}

        return true;
    }

    static async deleteApiKey() {
        inMemoryApiKey = '';

        // 1. 清除 extension_settings
        if (extension_settings.mind_engine) {
            delete extension_settings.mind_engine.apiKey;
            saveSettingsDebounced();
        }

        // 2. 清除 sessionStorage
        try {
            sessionStorage.removeItem(SECRET_KEY_ID);
        } catch (_) {}

        // 3. 清除服务端保险库
        try {
            await fetch('/api/secrets/delete', {
                method: 'POST',
                headers: safeGetRequestHeaders(),
                body: JSON.stringify({ key: SECRET_KEY_ID }),
            });
        } catch (_) {}
    }

    static maskKey(key) {
        if (!key) return '';
        if (key.length <= 8) return '••••••••';
        const prefix = key.slice(0, 7);
        const suffix = key.slice(-4);
        return `${prefix}••••••••••••••••${suffix}`;
    }
}

/**
 * ============================================================================
 * 纯正中英双语国际化字典
 * ============================================================================
 */
const I18N = {
    zh: {
        drawer_title: '灵犀 (Mind Compass)',
        engine_cloud_title: 'Jev 云端判定引擎',
        engine_status_sub: 'api.typesafe.ai | 官方直连 | 零本地后端',
        api_key_label: 'API 密钥配置',
        vault_protected: '密钥已就绪',
        get_key_link: '获取密钥',
        api_key_placeholder: '请输入 apikey_...',
        save_key_title: '保存密钥',
        toggle_key_title: '显示/隐藏密钥',
        clear_key_title: '清除密钥',
        btn_test_connection: '测试连接',
        api_status_default: '密钥保存在插件设置中；若开启 allowKeysExposure 亦会同步至原生保险库。',
        api_status_configured: 'API 密钥已配置并自动持久化。可点击「测试连接」验证。',
        api_status_empty: '请输入 TypeSafe API Key 以激活客观心智与羁绊罗盘。',
        api_status_testing: '正在连通 TypeSafe API 进行自检...',
        api_status_success: '连接成功，Jev 响应耗时: {latency}ms',
        api_status_failed: '连接失败: {error}',
        macro_section_title: '角色宏变量映射',
        macro_view_source: '卡内文本与宏高亮',
        macro_target_char: '目标角色',
        macro_char_default: '当前对话角色',
        macro_char_loading: '载入角色列表中...',
        macro_chips_hint: '卡内检测到的宏 (点击选择直接绑定)：',
        macro_affinity_label: '好感度写入宏',
        macro_affinity_desc: '默认 affinity',
        macro_stage_label: '关系阶段写入宏',
        macro_stage_desc: '默认 relationship_stage',
        macro_btn_default: '默认',
        macro_preview_title: '角色卡设定正文 (点击黄色高亮宏可直接绑定)',
        btn_save_macro: '保存角色宏映射',
        macro_save_success: '已保存',
        macro_detected_none: '卡内未发现自定义 {{宏}}',
        macro_match_count: '发现 {count} 个宏标记',
        opt_hud_title: '悬浮心智罗盘',
        opt_hud_desc: '在主视窗渲染可拖拽悬浮窗，展示好感度、心防护盾、深层信任与气场博弈刻度',
        opt_expr_title: '微表情立绘联动',
        opt_expr_desc: 'Jev 判定微表情自动驱动 28 种 GoEmotions 标准立绘差分平滑切换',
        opt_inject_title: '世界书广播注入',
        opt_inject_desc: '将好感度与阶段标签静默注入上下文，原生触发世界书剧情条目',
        opt_persist_title: '角色卡持久化',
        opt_persist_desc: '使用酒馆原生 writeExtensionField 写盘，换会话自动继承心智羁绊',
        btn_reset_mind: '重置当前角色心智状态',
        confirm_reset: '确定要将「{name}」的心智与好感度彻底重置回初始戒备状态吗？',
        toast_reset_success: '已重置 {name} 的心智档案',
        hud_char_default: '灵犀心智罗盘',
        hud_stat_affinity: '好感度',
        hud_stat_defense: '心防护盾',
        hud_stat_trust: '深层信任',
        hud_stat_dominance: '气场博弈',
        toast_saved_vault: 'API 密钥已成功保存并持久化',
        toast_cleared_vault: 'API 密钥已彻底清空',
        toast_missing_key: '请先在「灵犀」面板配置 TypeSafe API Key。',
        toast_fluctuation_title: '{name} 情感波动',
        toast_fluctuation_body: '好感度: {aff} ({delta}) | 心防: {def}% | 信任: {tru}% | 表情: {expr}',
        personality_section_title: '性格动力学调节',
        personality_tag_continuous: '纯连续特征',
        personality_section_desc: '无死板预设分类，纯连续特征调节。可由 Jev 自动推断并随时手动微调覆盖。',
        slider_flattery_label: '奉承抗性',
        slider_flattery_hint: '0.00: 极度受用夸赞 | 1.00: 极度反感谄媚',
        slider_vuln_label: '共鸣敏感度',
        slider_vuln_hint: '0.50: 情感冷感迟钝 | 2.00: 极度渴望脆弱共鸣',
        slider_defense_label: '初始心防壁垒',
        slider_defense_hint: '0.10: 幼驯染/无防备 | 0.95: 刺客/高冷死守',
        btn_analyze_personality: 'Jev 智能推断',
        btn_save_personality: '保存性格参数',
        personality_analyzing: 'Jev 正在推断角色性格...',
        personality_saved: '已保存至角色卡',
        personality_analyzed: '推断完成并保存',
        personality_analyze_failed: '推断失败: {error}',
        personality_default_hint: '使用默认均衡画像',
    },
    en: {
        drawer_title: 'Mind Compass',
        engine_cloud_title: 'Jev Cloud Engine',
        engine_status_sub: 'api.typesafe.ai | Direct HTTPS | Native Zero-Backend',
        api_key_label: 'API Key Configuration',
        vault_protected: 'Key Ready',
        get_key_link: 'Get Key',
        api_key_placeholder: 'Enter apikey_...',
        save_key_title: 'Save API Key',
        toggle_key_title: 'Show/Hide Key',
        clear_key_title: 'Clear API Key',
        btn_test_connection: 'Test Connection',
        api_status_default: 'Key is persisted in extension settings. If allowKeysExposure is enabled, it also syncs to secrets vault.',
        api_status_configured: 'API Key is configured and persisted. Click "Test Connection" to verify.',
        api_status_empty: 'Please enter TypeSafe API Key to activate Mind Compass.',
        api_status_testing: 'Connecting to TypeSafe API for diagnostic ping...',
        api_status_success: 'Connected! Latency: {latency}ms',
        api_status_failed: 'Connection failed: {error}',
        macro_section_title: 'Character Macro Mapping',
        macro_view_source: 'Card Text & Highlights',
        macro_target_char: 'Target Character',
        macro_char_default: 'Current Chat Character',
        macro_char_loading: 'Loading characters...',
        macro_chips_hint: 'Macros detected in card (click to bind):',
        macro_affinity_label: 'Affinity Macro Key',
        macro_affinity_desc: 'Default affinity',
        macro_stage_label: 'Stage Macro Key',
        macro_stage_desc: 'Default relationship_stage',
        macro_btn_default: 'Default',
        macro_preview_title: 'Card Prompt Source (Click yellow highlighted macros to bind)',
        btn_save_macro: 'Save Macro Mapping',
        macro_save_success: 'Saved',
        macro_detected_none: 'No custom {{macros}} found in card',
        macro_match_count: '{count} macros found',
        opt_hud_title: 'Floating Mind Compass',
        opt_hud_desc: 'Render draggable floating HUD displaying affinity, defense, trust and power dynamics',
        opt_expr_title: 'Character Expressions',
        opt_expr_desc: 'Auto-drive 28 GoEmotions sprite expressions based on Jev evaluation',
        opt_inject_title: 'World Info Injection',
        opt_inject_desc: 'Inject affinity status into prompt context to trigger World Info lorebooks',
        opt_persist_title: 'In-Card Persistence',
        opt_persist_desc: 'Save state into character card extensions via native writeExtensionField',
        btn_reset_mind: 'Reset Character Mind State',
        confirm_reset: 'Are you sure you want to reset mind state of "{name}" to initial cautious state?',
        toast_reset_success: 'Reset mind state for {name}',
        hud_char_default: 'MIND COMPASS',
        hud_stat_affinity: 'Affinity',
        hud_stat_defense: 'Defense Wall',
        hud_stat_trust: 'Trust Depth',
        hud_stat_dominance: 'Dominance',
        toast_saved_vault: 'API Key saved and persisted successfully',
        toast_cleared_vault: 'API Key cleared',
        toast_missing_key: 'Please configure TypeSafe API Key in Mind Compass panel first.',
        toast_fluctuation_title: '{name} Emotional Shift',
        toast_fluctuation_body: 'Affinity: {aff} ({delta}) | Defense: {def}% | Trust: {tru}% | Expr: {expr}',
        personality_section_title: 'Personality Dynamics Tuning',
        personality_tag_continuous: 'Continuous Traits',
        personality_section_desc: 'Continuous trait spectrum without rigid archetypes. Auto-inferred by Jev or manually tuned.',
        slider_flattery_label: 'Flattery Resistance',
        slider_flattery_hint: '0.00: Loves sweet talk | 1.00: Cynical / Disdains flattery',
        slider_vuln_label: 'Resonance Sensitivity',
        slider_vuln_hint: '0.50: Emotionally detached | 2.00: Deep craving for vulnerability',
        slider_defense_label: 'Baseline Defense Barrier',
        slider_defense_hint: '0.10: Childhood friend / Open | 0.95: Extreme paranoia / Aloof',
        btn_analyze_personality: 'Jev Auto-Infer',
        btn_save_personality: 'Save Personality',
        personality_analyzing: 'Jev is analyzing character traits...',
        personality_saved: 'Saved to card',
        personality_analyzed: 'Analysis complete & saved',
        personality_analyze_failed: 'Analysis failed: {error}',
        personality_default_hint: 'Using default balanced profile',
    }
};

function getLocale() {
    const raw = (
        window.i18next?.language ||
        window.user_settings?.language ||
        document.documentElement?.lang ||
        navigator?.language ||
        'en'
    ).toLowerCase();
    return raw.startsWith('zh') ? 'zh' : 'en';
}

function t(key, params = {}) {
    const loc = getLocale();
    let text = I18N[loc]?.[key] || I18N.en?.[key] || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return text;
}

function applyLocalization(root = document) {
    const $root = $(root);
    $root.find('[data-i18n]').each(function () {
        const key = $(this).attr('data-i18n');
        $(this).text(t(key));
    });
    $root.find('[data-i18n-ph]').each(function () {
        const key = $(this).attr('data-i18n-ph');
        $(this).attr('placeholder', t(key));
    });
    $root.find('[data-i18n-title]').each(function () {
        const key = $(this).attr('data-i18n-title');
        $(this).attr('title', t(key));
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 获取持久化非敏感设置对象
 */
function getSettings() {
    if (!extension_settings.mind_engine) {
        extension_settings.mind_engine = Object.assign({}, DEFAULT_SETTINGS);
        saveSettingsDebounced();
    }
    if (!extension_settings.mind_engine.macroBindings) {
        extension_settings.mind_engine.macroBindings = {};
    }
    return extension_settings.mind_engine;
}

/**
 * 从角色卡 extensions.mind_engine 读取持久化心智档案
 */
function getCharacterMindState(characterId) {
    const context = getContext();
    if (!context || !context.characters || characterId === undefined) return null;
    const char = context.characters[characterId];
    if (!char) return null;

    const extData = char.data?.extensions?.mind_engine || null;
    if (extData && extData.affinity !== undefined) {
        const defense = extData.defense_prob !== undefined ? parseFloat(extData.defense_prob) : 0.95;
        const trustDepth = extData.trust_depth !== undefined 
            ? parseFloat(extData.trust_depth) 
            : Math.max(0.05, +(1.0 - defense).toFixed(2));
        return {
            affinity: parseFloat(extData.affinity) || 10.0,
            relationship_stage: extData.relationship_stage || '初见戒备',
            defense_prob: defense,
            trust_depth: trustDepth,
            momentum: extData.momentum !== undefined ? parseFloat(extData.momentum) : 0.0,
            power_dynamic: extData.power_dynamic !== undefined ? parseFloat(extData.power_dynamic) : 3.5,
            expression: extData.expression || 'neutral',
            tts_style: extData.tts_style || 'calm',
        };
    }

    return {
        affinity: 10.0,
        relationship_stage: '初见戒备',
        defense_prob: 0.95,
        trust_depth: 0.05,
        momentum: 0.0,
        power_dynamic: 3.5,
        expression: 'neutral',
        tts_style: 'calm',
    };
}

/**
 * 从角色卡读取持久化性格动力学画像
 */
function getCharacterPersonalityProfile(characterId) {
    const context = getContext();
    if (!context || !context.characters || characterId === undefined) return null;
    const char = context.characters[characterId];
    if (!char) return null;

    const extData = char.data?.extensions?.mind_engine || null;
    if (extData && extData.personality_profile) {
        return AffinityDynamicsEngine.normalizeProfile(extData.personality_profile);
    }
    return null;
}

/**
 * 保存性格动力学画像到角色卡持久化存储
 */
async function saveCharacterPersonalityProfile(characterId, profile) {
    const context = getContext();
    if (!context || !context.characters || characterId === undefined) return;
    const char = context.characters[characterId];
    if (!char) return;

    const existingExt = char.data?.extensions?.mind_engine || {};
    const normalized = AffinityDynamicsEngine.normalizeProfile(profile);

    const payload = {
        ...existingExt,
        personality_profile: {
            ...normalized,
            updated_at: new Date().toISOString(),
        },
    };

    if (typeof writeExtensionField === 'function') {
        await writeExtensionField(characterId, 'mind_engine', payload);
    }
    if (!char.data) char.data = {};
    if (!char.data.extensions) char.data.extensions = {};
    char.data.extensions.mind_engine = payload;
}

/**
 * 持久化心智档案写入角色卡 (保留既有性格画像等扩展属性，杜绝踩踏覆盖)
 */
async function saveCharacterMindState(characterId, mindData) {
    const s = getSettings();
    if (!s.enablePersistence) return;

    const context = getContext();
    if (!context || !context.characters || characterId === undefined) return;
    const char = context.characters[characterId];
    if (!char) return;

    const existingExt = char.data?.extensions?.mind_engine || {};

    const payload = {
        ...existingExt,
        affinity: typeof mindData.new_affinity === 'number' ? mindData.new_affinity : mindData.affinity,
        relationship_stage: mindData.stage || mindData.relationship_stage || '初见戒备',
        defense_prob: mindData.defense_prob !== undefined ? mindData.defense_prob : 0.95,
        trust_depth: mindData.trust_depth !== undefined ? mindData.trust_depth : 0.05,
        momentum: mindData.momentum !== undefined ? mindData.momentum : 0.0,
        power_dynamic: mindData.power_score !== undefined ? mindData.power_score : (mindData.power_dynamic || 3.5),
        expression: mindData.expression || 'neutral',
        tts_style: mindData.tts_style || 'calm',
        updated_at: new Date().toISOString(),
    };

    if (typeof writeExtensionField === 'function') {
        await writeExtensionField(characterId, 'mind_engine', payload);
    }
    if (!char.data) char.data = {};
    if (!char.data.extensions) char.data.extensions = {};
    char.data.extensions.mind_engine = payload;
}

/**
 * 获取指定角色的宏映射配置
 */
function getCharacterMacroBinding(charName) {
    const s = getSettings();
    const binding = s.macroBindings?.[charName] || {};
    return {
        affinity: binding.affinity || 'affinity',
        stage: binding.stage || 'relationship_stage',
    };
}

/**
 * 保存指定角色的宏映射配置
 */
function saveCharacterMacroBinding(charName, affinityMacro, stageMacro) {
    const s = getSettings();
    s.macroBindings[charName] = {
        affinity: affinityMacro.trim() || 'affinity',
        stage: stageMacro.trim() || 'relationship_stage',
    };
    saveSettingsDebounced();
}

/**
 * 组装角色卡完整文本设定
 */
function getCharacterFullText(char) {
    if (!char) return '';
    const parts = [];
    const p = char.data?.personality || char.personality;
    if (p) parts.push(`[Personality / 性格设定]\n${p}`);
    const d = char.data?.description || char.description;
    if (d) parts.push(`[Description / 角色描述]\n${d}`);
    const s = char.data?.system_prompt || char.system;
    if (s) parts.push(`[System Prompt / 系统提示]\n${s}`);
    const m = char.data?.mes_example || char.mes_example;
    if (m) parts.push(`[Examples / 对话范例]\n${m}`);
    return parts.join('\n\n');
}

/**
 * 扫描并高亮渲染角色卡正文中的 {{macro}}，并提取独立宏集合
 */
function inspectAndHighlightMacros(char) {
    const fullText = getCharacterFullText(char);
    if (!fullText) {
        return { uniqueMacros: [], highlightedHtml: '(当前角色卡未填写文本描述)' };
    }

    const re = /\{\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}\}/g;
    const uniqueMacros = new Set();
    let matchCount = 0;

    // 先做安全转义
    const safeText = escapeHtml(fullText);

    // 将安全文本中的 {{macro}} 替换为可交互的高亮标记
    const highlightedHtml = safeText.replace(re, (match, macroName) => {
        if (!['user', 'char', 'User', 'Char'].includes(macroName)) {
            uniqueMacros.add(macroName);
            matchCount++;
            return `<mark class="mind-highlight-macro" data-macro="${macroName}" title="点击填入当前选定输入框">{{${macroName}}}</mark>`;
        }
        return match;
    });

    return {
        uniqueMacros: Array.from(uniqueMacros),
        highlightedHtml,
        matchCount,
    };
}

/**
 * 刷新角色宏选择器界面与回填
 */
function populateMacroSelector() {
    const context = getContext();
    const charactersList = context?.characters || [];
    const select = $('#mind_macro_char_select');
    if (!select.length) return;

    const previousVal = select.val();
    select.empty();

    const activeCharId = context?.characterId;
    const activeChar = (activeCharId !== undefined && charactersList[activeCharId]) ? charactersList[activeCharId] : null;

    if (!charactersList || charactersList.length === 0) {
        select.append($('<option value=""></option>').text(t('macro_char_loading')));
        return;
    }

    let hasSelected = false;
    charactersList.forEach((c) => {
        if (!c || !c.name) return;
        const opt = $('<option></option>').val(c.name).text(c.name);
        if (previousVal ? c.name === previousVal : (activeChar && c.name === activeChar.name)) {
            opt.prop('selected', true);
            hasSelected = true;
        }
        select.append(opt);
    });

    if (!hasSelected && activeChar) {
        select.val(activeChar.name);
    }

    const targetCharName = select.val() || activeChar?.name || '';
    onSelectedMacroCharChanged(targetCharName);
}

/**
 * 将宏名称精准注入到当前选中的输入框，并提供视觉反馈
 */
function applyMacroToInput(macroName) {
    if (!macroName) return;
    const targetInputId = lastFocusedMacroInputId || 'mind_macro_affinity_input';
    const targetInput = $(`#${targetInputId}`);
    if (targetInput.length) {
        targetInput.val(macroName);
        targetInput.css({ outline: '2px solid var(--SmartThemeQuoteColor, #38bdf8)' });
        setTimeout(() => targetInput.css({ outline: '' }), 600);
    }
}

/**
 * 响应角色下拉框切换：回填已存宏配置、渲染胶囊与正文高亮审查
 */
function onSelectedMacroCharChanged(charName) {
    if (!charName) return;
    const context = getContext();
    const char = context?.characters?.find(c => c && c.name === charName);

    // 1. 回填已保存的宏
    const binding = getCharacterMacroBinding(charName);
    $('#mind_macro_affinity_input').val(binding.affinity);
    $('#mind_macro_stage_input').val(binding.stage);

    // 2. 扫描并高亮渲染正文
    const { uniqueMacros, highlightedHtml, matchCount } = inspectAndHighlightMacros(char);

    // 3. 填充候选胶囊池
    const chipsContainer = $('#mind_macro_chips_container');
    const chipsList = $('#mind_macro_chips_list');
    chipsList.empty();

    if (uniqueMacros.length > 0) {
        uniqueMacros.forEach((macro) => {
            const chip = $('<span class="mind-macro-chip" title="点击填入当前输入框"></span>')
                .text(`{{${macro}}}`)
                .attr('data-macro', macro)
                .on('click', function () {
                    applyMacroToInput(macro);
                });
            chipsList.append(chip);
        });
        chipsContainer.show();
    } else {
        chipsContainer.hide();
    }

    // 4. 填充角色卡正文高亮区
    $('#mind_macro_match_count').text(t('macro_match_count', { count: matchCount || 0 }));
    const previewContent = $('#mind_card_preview_content');
    previewContent.html(highlightedHtml);

    // 绑定正文内所有黄色高亮宏的点击事件
    previewContent.find('.mind-highlight-macro').on('click', function () {
        const macro = $(this).attr('data-macro');
        applyMacroToInput(macro);
    });

    // 5. 回填性格动力学调节滑块
    const charId = context?.characters?.findIndex(c => c && c.name === charName);
    let profile = null;
    if (charId !== -1 && charId !== undefined) {
        profile = getCharacterPersonalityProfile(charId);
    }
    const finalProfile = profile || {
        flattery_resistance: 0.50,
        vulnerability_need: 1.00,
        baseline_defense: 0.80,
    };
    renderPersonalitySliders(finalProfile, !!profile);
}

/**
 * 刷新性格动力学滑块与数值徽标
 */
function renderPersonalitySliders(profile, hasSavedProfile) {
    const fRes = typeof profile.flattery_resistance === 'number' ? profile.flattery_resistance : 0.50;
    const vNeed = typeof profile.vulnerability_need === 'number' ? profile.vulnerability_need : 1.00;
    const bDef = typeof profile.baseline_defense === 'number' ? profile.baseline_defense : 0.80;

    $('#mind_slider_flattery').val(fRes.toFixed(2));
    $('#mind_val_flattery').text(fRes.toFixed(2));

    $('#mind_slider_vuln').val(vNeed.toFixed(2));
    $('#mind_val_vuln').text(vNeed.toFixed(2));

    $('#mind_slider_defense').val(bDef.toFixed(2));
    $('#mind_val_defense').text(bDef.toFixed(2));

    const statusEl = $('#mind_personality_status');
    if (hasSavedProfile) {
        statusEl.text(t('personality_saved')).css('color', '#10b981').show();
        setTimeout(() => statusEl.fadeOut(800), 3000);
    } else {
        statusEl.text(t('personality_default_hint')).css('color', 'var(--SmartThemeEmColor, #94a3b8)').show();
    }
}

/**
 * 视口边界钳位：防止面板在折叠/展开、拖拽或窗口缩放时超出屏幕视窗
 * @param {boolean} isExpanding - 是否处于展开触发动作
 */
function clampHudToViewport(isExpanding = false) {
    const hud = document.getElementById('jev-mind-hud');
    if (!hud) return;

    const willBeExpanded = isExpanding || !hud.classList.contains('collapsed');
    const safeMargin = 10;

    // 展开态宽度固定 245px，高度约 245px；折叠态宽度约 75px，高度约 32px
    const targetWidth = willBeExpanded ? 245 : (hud.offsetWidth || 75);
    const targetHeight = willBeExpanded ? Math.max(245, hud.offsetHeight) : (hud.offsetHeight || 32);

    const maxLeft = Math.max(safeMargin, window.innerWidth - targetWidth - safeMargin);
    const maxTop = Math.max(safeMargin, window.innerHeight - targetHeight - safeMargin);

    const rect = hud.getBoundingClientRect();
    let curLeft = (hud.style.left && hud.style.left !== 'auto') ? parseFloat(hud.style.left) : rect.left;
    let curTop = (hud.style.top && hud.style.top !== 'auto') ? parseFloat(hud.style.top) : rect.top;

    if (isNaN(curLeft)) curLeft = rect.left;
    if (isNaN(curTop)) curTop = rect.top;

    const clampedLeft = Math.round(Math.max(safeMargin, Math.min(maxLeft, curLeft)));
    const clampedTop = Math.round(Math.max(safeMargin, Math.min(maxTop, curTop)));

    hud.style.left = `${clampedLeft}px`;
    hud.style.top = `${clampedTop}px`;
    hud.style.right = 'auto';
    hud.style.bottom = 'auto';
}

/**
 * 交互拖拽与折叠绑定
 */
function initHudInteraction() {
    const hud = document.getElementById('jev-mind-hud');
    if (!hud) return;

    const btnCollapse = document.getElementById('hud-btn-collapse');

    // 1. 折叠按键独立事件：点击立即缩小为微型晶体并钳位边界
    if (btnCollapse) {
        btnCollapse.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            hud.classList.add('collapsed');
            clampHudToViewport(false);
        });
    }

    // 2. 拖拽与微型光核展开交互
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, initialLeft, initialTop;

    hud.addEventListener('mousedown', (e) => {
        if (e.target.closest('#hud-btn-collapse')) return;

        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = hud.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
            hud.classList.add('is-dragging');
        }

        const safeMargin = 10;
        let newLeft = Math.max(safeMargin, Math.min(window.innerWidth - hud.offsetWidth - safeMargin, initialLeft + dx));
        let newTop = Math.max(safeMargin, Math.min(window.innerHeight - hud.offsetHeight - safeMargin, initialTop + dy));

        hud.style.left = `${newLeft}px`;
        hud.style.top = `${newTop}px`;
        hud.style.right = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        hud.classList.remove('is-dragging');

        if (!hasMoved && hud.classList.contains('collapsed')) {
            hud.classList.remove('collapsed');
            clampHudToViewport(true);
        } else {
            clampHudToViewport(false);
        }
    });

    // 3. 视口大小变动监听，自动防溢出锁死
    window.addEventListener('resize', () => {
        clampHudToViewport(false);
    });
}

/**
 * 构建并挂载原生毛玻璃 HUD
 */
function ensureHudMounted() {
    if ($('#jev-mind-hud').length > 0) return;

    const hudHtml = `
    <div id="jev-mind-hud">
        <div class="hud-mini-orb" title="点击展开灵犀心智罗盘 / 拖拽移动">
            <i class="fa-solid fa-compass hud-mini-icon"></i>
            <span id="hud-mini-aff" class="hud-mini-aff">10.0</span>
        </div>
        <div class="hud-main-content">
            <div class="hud-header">
                <div class="hud-header-left">
                    <i class="fa-solid fa-compass" style="color: var(--SmartThemeQuoteColor, #38bdf8); font-size: 13px;"></i>
                    <span id="hud-char-title" class="hud-title-text" data-i18n="hud_char_default">灵犀心智罗盘</span>
                </div>
                <div class="hud-header-right">
                    <span id="hud-stage-pill" class="hud-stage-pill">初见戒备</span>
                    <button id="hud-btn-collapse" class="hud-btn-collapse" title="折叠面板">
                        <i class="fa-solid fa-chevron-up"></i>
                    </button>
                </div>
            </div>
            <!-- 1. 好感度 -->
            <div class="hud-row">
                <div class="hud-meta-line">
                    <span class="hud-axis-label" data-i18n="hud_stat_affinity">好感度</span>
                    <span id="hud-affinity-val" class="hud-val-num">10.00 / 100</span>
                </div>
                <div class="hud-track-fine">
                    <div id="hud-affinity-fill" class="hud-fill-fine hud-fill-aff" style="width: 10%;"></div>
                </div>
                <div id="hud-affinity-delta" class="hud-delta-tag"></div>
            </div>
            <!-- 2. 心防护盾 -->
            <div class="hud-row">
                <div class="hud-meta-line">
                    <span class="hud-axis-label" data-i18n="hud_stat_defense">心防护盾</span>
                    <span id="hud-defense-val" class="hud-val-num">95%</span>
                </div>
                <div class="hud-track-fine">
                    <div id="hud-defense-fill" class="hud-fill-fine hud-fill-def" style="width: 95%;"></div>
                </div>
            </div>
            <!-- 3. 深层信任 -->
            <div class="hud-row">
                <div class="hud-meta-line">
                    <span class="hud-axis-label" data-i18n="hud_stat_trust">深层信任</span>
                    <span id="hud-trust-val" class="hud-val-num">5%</span>
                </div>
                <div class="hud-track-fine">
                    <div id="hud-trust-fill" class="hud-fill-fine hud-fill-tru" style="width: 5%;"></div>
                </div>
            </div>
            <!-- 4. 气场博弈 -->
            <div class="hud-row">
                <div class="hud-meta-line">
                    <span class="hud-axis-label" data-i18n="hud_stat_dominance">气场博弈</span>
                    <span id="hud-power-val" class="hud-val-num">3.50</span>
                </div>
                <div class="hud-track-fine">
                    <div id="hud-power-fill" class="hud-fill-fine hud-fill-pow" style="width: 87.5%;"></div>
                </div>
            </div>
        </div>
    </div>
    `;

    $('body').append(hudHtml);
    applyLocalization($('#jev-mind-hud'));
    initHudInteraction();
}

/**
 * 刷新 HUD 界面显示与跳字
 */
function updateHudDisplay(data, delta = 0) {
    const s = getSettings();
    if (!s.enableHud) {
        $('#jev-mind-hud').hide();
        return;
    }
    $('#jev-mind-hud').show();

    const affinity = typeof data.new_affinity === 'number' ? data.new_affinity : (data.affinity !== undefined ? data.affinity : 10.0);
    const stage = data.stage || data.relationship_stage || '初见戒备';
    const defenseProb = data.defense_prob !== undefined ? data.defense_prob : 0.95;
    const trustDepth = data.trust_depth !== undefined ? data.trust_depth : 0.05;
    const powerScore = data.power_score !== undefined ? data.power_score : (data.power_dynamic !== undefined ? data.power_dynamic : 3.5);

    $('#hud-mini-aff').text(affinity.toFixed(1));
    $('#hud-stage-pill').text(stage);
    $('#hud-affinity-val').text(`${affinity.toFixed(2)} / 100`);
    $('#hud-affinity-fill').css('width', `${Math.min(100, Math.max(0, affinity))}%`);

    const defensePct = Math.round(defenseProb * 100);
    $('#hud-defense-val').text(`${defensePct}%`);
    $('#hud-defense-fill').css('width', `${defensePct}%`);

    const trustPct = Math.round(trustDepth * 100);
    $('#hud-trust-val').text(`${trustPct}%`);
    $('#hud-trust-fill').css('width', `${trustPct}%`);

    const powerPct = Math.round((powerScore / 4.0) * 100);
    $('#hud-power-val').text(powerScore.toFixed(2));
    $('#hud-power-fill').css('width', `${Math.min(100, Math.max(0, powerPct))}%`);

    if (delta !== 0) {
        const deltaTag = $('#hud-affinity-delta');
        const isUp = delta > 0;
        deltaTag.text(isUp ? `+${delta.toFixed(2)}` : `${delta.toFixed(2)}`);
        deltaTag.removeClass('hud-delta-up hud-delta-down show');
        deltaTag.addClass(isUp ? 'hud-delta-up' : 'hud-delta-down');
        if (deltaTag[0]) void deltaTag[0].offsetWidth;
        deltaTag.addClass('show');
        setTimeout(() => deltaTag.removeClass('show'), 2200);
    }
}

/**
 * 测试 TypeSafe API Key 连通性
 */
async function testApiKeyConnection(key) {
    if (!key) {
        $('#mind_engine_indicator').css({ background: '#ef4444', boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' });
        $('#mind_api_status').css('color', '#ef4444').text(t('api_status_empty'));
        return false;
    }

    $('#mind_api_status').css('color', 'var(--SmartThemeQuoteColor, #38bdf8)').text(t('api_status_testing'));
    const startTime = performance.now();

    try {
        const evaluator = new JevEvaluator(key);
        await evaluator.evaluateTurn(
            { name: 'SelfTest', personality: 'analytical', description: '', mes_examples: '', system_prompt: '' },
            'System diagnostic ping',
            'All systems normal.',
            null,
            10000
        );

        const latency = Math.round(performance.now() - startTime);
        $('#mind_engine_indicator').css({ background: '#10b981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)' });
        $('#mind_engine_status_text').text(`api.typesafe.ai | Connected (${latency}ms)`);
        $('#mind_api_status').css('color', '#10b981').text(t('api_status_success', { latency }));
        if (window.toastr) window.toastr.success(`TypeSafe API (${latency}ms)`, t('drawer_title'));
        return true;
    } catch (err) {
        $('#mind_engine_indicator').css({ background: '#ef4444', boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)' });
        $('#mind_engine_status_text').text('TypeSafe Cloud Error');
        $('#mind_api_status').css('color', '#ef4444').text(t('api_status_failed', { error: err.message }));
        if (window.toastr) window.toastr.error(`${err.message}`, t('drawer_title'));
        return false;
    }
}

/**
 * 渲染密钥输入框脱敏/显式状态
 */
function renderKeyInputState(key) {
    const input = $('#mind_api_key');
    if (!key) {
        input.val('').attr('type', 'password');
        $('#mind_vault_badge').hide();
        $('#mind_engine_indicator').css({ background: '#94a3b8' });
        $('#mind_api_status').css('color', 'var(--SmartThemeEmColor, #64748b)').text(t('api_status_empty'));
        return;
    }

    $('#mind_vault_badge').show();
    $('#mind_engine_indicator').css({ background: 'var(--SmartThemeQuoteColor, #38bdf8)', boxShadow: '0 0 6px rgba(56, 189, 248, 0.8)' });
    $('#mind_api_status').css('color', 'var(--SmartThemeEmColor, #94a3b8)').text(t('api_status_configured'));

    if (isKeyRevealed) {
        input.val(key).attr('type', 'text');
    } else {
        input.val(SecretVaultManager.maskKey(key)).attr('type', 'text');
    }
}

/**
 * 挂载设置抽屉
 */
async function loadSettingsDrawer() {
    if ($('#mind_engine_settings').length > 0) return;

    try {
        const htmlUrl = new URL('settings.html', import.meta.url).href;
        const resp = await fetch(htmlUrl);
        if (!resp.ok) {
            console.warn(`[${MODULE_NAME}] 加载 settings.html 失败: ${resp.status}`);
            return;
        }
        const html = await resp.text();
        $('#extensions_settings').append(html);

        applyLocalization($('#mind_engine_settings'));

        const s = getSettings();
        const initialKey = await SecretVaultManager.getApiKey();
        renderKeyInputState(initialKey);

        // 密码框交互
        $('#mind_api_key').on('focus', function () {
            if (!isKeyRevealed && $(this).val().includes('••••')) {
                $(this).val('').attr('type', 'password');
            }
        }).on('blur', async function () {
            const currentVal = $(this).val().trim();
            if (!currentVal) {
                const currentKey = await SecretVaultManager.getApiKey();
                renderKeyInputState(currentKey);
            }
        });

        $('#btn_save_key').on('click', async function () {
            const inputVal = $('#mind_api_key').val().trim();
            if (inputVal && !inputVal.includes('••••')) {
                await SecretVaultManager.saveApiKey(inputVal);
                isKeyRevealed = false;
                renderKeyInputState(inputVal);
                if (window.toastr) window.toastr.success(t('toast_saved_vault'), t('drawer_title'));
            }
        });

        $('#btn_toggle_key_vis').on('click', async function () {
            const currentKey = await SecretVaultManager.getApiKey();
            if (!currentKey) return;
            isKeyRevealed = !isKeyRevealed;
            renderKeyInputState(currentKey);
        });

        $('#btn_clear_key').on('click', async function () {
            await SecretVaultManager.deleteApiKey();
            isKeyRevealed = false;
            renderKeyInputState('');
            if (window.toastr) window.toastr.info(t('toast_cleared_vault'), t('drawer_title'));
        });

        $('#btn_test_connection').on('click', async function () {
            const inputVal = $('#mind_api_key').val().trim();
            // 优先取输入框中的真实明文密钥；若为脱敏掩码或空则从内存/保险库读取
            const isRealInput = inputVal && !inputVal.includes('••••');
            const key = isRealInput ? inputVal : await SecretVaultManager.getApiKey();
            if (isRealInput) {
                // 保存真实输入值到内存与 sessionStorage，方便本次会话复用
                await SecretVaultManager.saveApiKey(key);
                renderKeyInputState(key);
            }
            testApiKeyConnection(key);
        });

        // 记录聚焦的宏输入框
        $('#mind_macro_affinity_input').on('focus', function () {
            lastFocusedMacroInputId = 'mind_macro_affinity_input';
        });
        $('#mind_macro_stage_input').on('focus', function () {
            lastFocusedMacroInputId = 'mind_macro_stage_input';
        });

        // 默认按钮快捷重置
        $('#btn_reset_aff_default').on('click', function () {
            $('#mind_macro_affinity_input').val('affinity');
        });
        $('#btn_reset_stg_default').on('click', function () {
            $('#mind_macro_stage_input').val('relationship_stage');
        });

        // 角色卡正文预览折叠切换
        $('#btn_toggle_card_preview').on('click', function () {
            $('#mind_card_preview_box').slideToggle(200);
        });

        // 角色宏映射逻辑绑定与多重刷新保障
        populateMacroSelector();

        $('#mind_engine_settings .inline-drawer-toggle').on('click', () => {
            populateMacroSelector();
        });

        $('#mind_macro_char_select').on('focus', () => {
            populateMacroSelector();
        }).on('change', function () {
            onSelectedMacroCharChanged($(this).val());
        });

        $('#btn_save_macro_binding').on('click', function () {
            const charName = $('#mind_macro_char_select').val();
            const aff = $('#mind_macro_affinity_input').val();
            const stg = $('#mind_macro_stage_input').val();
            if (charName) {
                saveCharacterMacroBinding(charName, aff, stg);
                const statusEl = $('#mind_macro_save_status');
                statusEl.fadeIn(200);
                setTimeout(() => statusEl.fadeOut(600), 2000);
            }
        });

        // 性格动力学滑块变动即时回显
        $('#mind_slider_flattery').on('input', function () {
            $('#mind_val_flattery').text(parseFloat($(this).val()).toFixed(2));
        });
        $('#mind_slider_vuln').on('input', function () {
            $('#mind_val_vuln').text(parseFloat($(this).val()).toFixed(2));
        });
        $('#mind_slider_defense').on('input', function () {
            $('#mind_val_defense').text(parseFloat($(this).val()).toFixed(2));
        });

        // 保存性格参数
        $('#btn_save_personality').on('click', async function () {
            const charName = $('#mind_macro_char_select').val();
            const context = getContext();
            const charId = context?.characters?.findIndex(c => c && c.name === charName);
            if (charId === -1 || charId === undefined) return;

            const profile = {
                flattery_resistance: parseFloat($('#mind_slider_flattery').val()),
                vulnerability_need: parseFloat($('#mind_slider_vuln').val()),
                baseline_defense: parseFloat($('#mind_slider_defense').val()),
            };

            await saveCharacterPersonalityProfile(charId, profile);
            const statusEl = $('#mind_personality_status');
            statusEl.text(t('personality_saved')).css('color', '#10b981').fadeIn(200);
            setTimeout(() => statusEl.fadeOut(600), 2500);

            if (window.toastr) {
                window.toastr.success(t('personality_saved'), t('drawer_title'));
            }
        });

        // Jev 智能推断性格按键
        $('#btn_analyze_personality').on('click', async function () {
            const charName = $('#mind_macro_char_select').val();
            const context = getContext();
            const charId = context?.characters?.findIndex(c => c && c.name === charName);
            const char = (charId !== -1 && charId !== undefined) ? context?.characters?.[charId] : null;
            if (!char) return;

            const apiKey = await SecretVaultManager.getApiKey();
            if (!apiKey) {
                if (window.toastr) window.toastr.warning(t('toast_missing_key'), t('drawer_title'));
                return;
            }

            const statusEl = $('#mind_personality_status');
            statusEl.text(t('personality_analyzing')).css('color', 'var(--SmartThemeQuoteColor, #38bdf8)').fadeIn(200);

            try {
                const evaluator = new JevEvaluator(apiKey);
                const charProfile = {
                    name: char.name || 'NPC',
                    personality: char.personality || char.data?.personality || '',
                    description: char.description || char.data?.description || '',
                    system_prompt: char.system_prompt || char.data?.system_prompt || '',
                    mes_examples: char.mes_example || char.data?.mes_example || '',
                };

                const inferred = await evaluator.analyzePersonalityProfile(charProfile, 15000);
                renderPersonalitySliders(inferred, true);
                await saveCharacterPersonalityProfile(charId, inferred);

                statusEl.text(t('personality_analyzed')).css('color', '#10b981').fadeIn(200);
                setTimeout(() => statusEl.fadeOut(600), 3000);

                if (window.toastr) {
                    window.toastr.success(t('personality_analyzed'), t('drawer_title'));
                }
            } catch (err) {
                console.warn(`[${MODULE_NAME}] Jev 性格推断失败:`, err);
                statusEl.text(t('personality_analyze_failed', { error: err.message })).css('color', '#ef4444').fadeIn(200);
                if (window.toastr) {
                    window.toastr.warning(t('personality_analyze_failed', { error: err.message }), t('drawer_title'));
                }
            }
        });

        // 功能开关
        $('#toggle_mind_hud').prop('checked', s.enableHud).on('change', function () {
            s.enableHud = $(this).prop('checked');
            saveSettingsDebounced();
            $('#jev-mind-hud').toggle(s.enableHud);
        });
        $('#toggle_mind_expressions').prop('checked', s.enableExpressions).on('change', function () {
            s.enableExpressions = $(this).prop('checked');
            saveSettingsDebounced();
        });
        $('#toggle_mind_injection').prop('checked', s.enableInjection).on('change', function () {
            s.enableInjection = $(this).prop('checked');
            saveSettingsDebounced();
        });
        $('#toggle_mind_persist').prop('checked', s.enablePersistence).on('change', function () {
            s.enablePersistence = $(this).prop('checked');
            saveSettingsDebounced();
        });

        // 底部重置按钮
        $('#btn_reset_mind_state').on('click', async function () {
            const context = getContext();
            if (context.characterId === undefined) return;
            const char = context.characters[context.characterId];
            if (!char) return;

            const confirmMsg = t('confirm_reset', { name: char.name });
            if (!confirm(confirmMsg)) return;

            const initialData = {
                new_affinity: 10.0,
                stage: '初见戒备',
                defense_prob: 0.95,
                trust_depth: 0.05,
                momentum: 0.0,
                power_score: 3.5,
                expression: 'neutral',
                tts_style: 'calm',
            };

            const binding = getCharacterMacroBinding(char.name);
            await context.executeSlashCommands(`/setvar key=${binding.affinity} 10.0`);
            await context.executeSlashCommands(`/setvar key=${binding.stage} 初见戒备`);
            if (binding.affinity !== 'affinity') await context.executeSlashCommands(`/setvar key=affinity 10.0`);
            if (binding.stage !== 'relationship_stage') await context.executeSlashCommands(`/setvar key=relationship_stage 初见戒备`);

            await saveCharacterMindState(context.characterId, initialData);
            updateHudDisplay(initialData, 0);

            if (window.toastr) {
                window.toastr.success(t('toast_reset_success', { name: char.name }), t('drawer_title'));
            }
        });

    } catch (err) {
        console.warn(`[${MODULE_NAME}] 加载 settings.html 异常:`, err);
    }
}

/**
 * 注册酒馆原生动态宏拦截器 (支持 {{affinity}}, {{relationship_stage}} 及自定义宏)
 */
function registerNativeMacros() {
    const context = getContext();
    if (!context || typeof context.registerMacro !== 'function') return;

    try {
        context.registerMacro('affinity', () => {
            const ctx = getContext();
            if (!ctx || ctx.characterId === undefined) return '10.0';
            const state = getCharacterMindState(ctx.characterId);
            return state ? (typeof state.affinity === 'number' ? state.affinity.toFixed(1) : state.affinity) : '10.0';
        }, '灵犀心智引擎当前好感度数值');

        context.registerMacro('relationship_stage', () => {
            const ctx = getContext();
            if (!ctx || ctx.characterId === undefined) return '初见戒备';
            const state = getCharacterMindState(ctx.characterId);
            return state ? (state.relationship_stage || state.stage || '初见戒备') : '初见戒备';
        }, '灵犀心智引擎当前关系阶段');
    } catch (e) {
        console.warn(`[${MODULE_NAME}] 注册原生宏失败:`, e);
    }
}

/**
 * 注册自定义绑定的原生宏拦截器
 */
function registerCustomMacroBinding(affinityKey, stageKey) {
    const context = getContext();
    if (!context || typeof context.registerMacro !== 'function') return;
    try {
        if (affinityKey && affinityKey !== 'affinity') {
            context.registerMacro(affinityKey, () => {
                const ctx = getContext();
                if (!ctx || ctx.characterId === undefined) return '10.0';
                const state = getCharacterMindState(ctx.characterId);
                return state ? (typeof state.affinity === 'number' ? state.affinity.toFixed(1) : state.affinity) : '10.0';
            }, `灵犀心智引擎自定义好感度宏 (${affinityKey})`);
        }
        if (stageKey && stageKey !== 'relationship_stage') {
            context.registerMacro(stageKey, () => {
                const ctx = getContext();
                if (!ctx || ctx.characterId === undefined) return '初见戒备';
                const state = getCharacterMindState(ctx.characterId);
                return state ? (state.relationship_stage || state.stage || '初见戒备') : '初见戒备';
            }, `灵犀心智引擎自定义关系阶段宏 (${stageKey})`);
        }
    } catch (e) {
        console.warn(`[${MODULE_NAME}] 注册自定义原生宏失败:`, e);
    }
}

/**
 * 会话切换/新开会话同步
 */
function onContextSync() {
    const context = getContext();
    if (!context || context.characterId === undefined) return;
    const char = context.characters?.[context.characterId];
    if (!char) return;

    const mindData = getCharacterMindState(context.characterId);
    if (!mindData) return;

    const binding = getCharacterMacroBinding(char.name);

    registerNativeMacros();
    registerCustomMacroBinding(binding.affinity, binding.stage);

    if (typeof context.executeSlashCommands === 'function') {
        context.executeSlashCommands(`/setvar key=${binding.affinity} ${mindData.affinity}`);
        context.executeSlashCommands(`/setvar key=${binding.stage} ${mindData.relationship_stage}`);
        if (binding.affinity !== 'affinity') context.executeSlashCommands(`/setvar key=affinity ${mindData.affinity}`);
        if (binding.stage !== 'relationship_stage') context.executeSlashCommands(`/setvar key=relationship_stage ${mindData.relationship_stage}`);
    }

    const defaultTitle = t('hud_char_default');
    $('#hud-char-title').text(char.name ? char.name : defaultTitle);
    updateHudDisplay(mindData, 0);

    // 同步刷新宏选择器
    populateMacroSelector();
}

/**
 * 构建中英双语世界书广播注入标签
 */
function buildBilingualInjectTag(data) {
    const stage = data.stage || '初见戒备';
    const aliases = data.stage_aliases || getStageAliases(stage);
    const aff = typeof data.new_affinity === 'number' ? data.new_affinity.toFixed(1) : '10.0';
    const def = data.defense_prob !== undefined ? Math.round(data.defense_prob * 100) : 95;
    const trust = data.trust_depth !== undefined ? Math.round(data.trust_depth * 100) : 5;
    const expr = data.expression || 'neutral';
    const power = data.power_score !== undefined ? data.power_score.toFixed(1) : '3.5';

    return `[MindCompass: 阶段=${stage} (${aliases}) | 好感度=${aff} Affinity=${aff} | 心防=${def}% Defense=${def}% | 信任=${trust}% Trust=${trust}% | 微表情=${expr} | 气场=${power}]`;
}

/**
 * 判定是否有实质性状态变化需要写盘
 */
function hasSignificantChange(data, prevState) {
    if (!prevState) return true;
    if (data.actual_delta !== 0) return true;
    if (data.expression !== prevState.expression) return true;
    if (Math.abs(data.defense_prob - prevState.defense_prob) > 0.01) return true;
    if (Math.abs((data.trust_depth ?? 0.05) - (prevState.trust_depth ?? 0.05)) > 0.01) return true;
    if (Math.abs((data.momentum ?? 0.0) - (prevState.momentum ?? 0.0)) > 0.05) return true;
    if (Math.abs(data.power_score - (prevState.power_dynamic || 3.5)) > 0.05) return true;
    return false;
}

/**
 * 安全转义字符串中的特殊引号
 */
function escapeForSlash(str) {
    return str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

/**
 * 核心判定函数
 */
async function evaluateMessage(messageId) {
    if (isEvaluating) return;
    if (messageId !== undefined && messageId === lastEvaluatedMessageId) return;

    const apiKey = await SecretVaultManager.getApiKey();
    if (!apiKey) {
        if (!hasWarnedMissingKey && window.toastr) {
            window.toastr.warning(t('toast_missing_key'), t('drawer_title'), { timeOut: 7000 });
            hasWarnedMissingKey = true;
        }
        return;
    }

    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) return;

    const targetIdx = (typeof messageId === 'number') ? messageId : (context.chat.length - 1);
    const lastMessage = context.chat[targetIdx];

    // 守卫 1: 必须是角色回复
    if (!lastMessage || lastMessage.is_user || lastMessage.is_system) {
        return;
    }

    // 守卫 2: 命中开场白
    if (targetIdx === 0 || context.chat.length === 1) {
        return;
    }

    // 守卫 3: 溯源前序有效用户发言
    const userMessage = context.chat.slice(0, targetIdx).reverse().find(m => m.is_user)?.mes?.trim();
    if (!userMessage) {
        return;
    }

    const characterName = context.name2 || 'NPC';
    let personality = '';
    let description = '';
    let mesExamples = '';
    let systemPrompt = '';

    try {
        if (typeof context.getCharacterCardFields === 'function') {
            const fields = context.getCharacterCardFields();
            personality = fields.personality || '';
            description = fields.description || '';
            mesExamples = fields.mesExamples || '';
            systemPrompt = fields.system || '';
        }
    } catch (_) {
        const characterCard = context.characters?.[context.characterId] || {};
        personality = characterCard.personality || '';
        description = characterCard.description || '';
        mesExamples = characterCard.mes_example || '';
    }

    const currentMindState = getCharacterMindState(context.characterId);
    const currentAffinity = currentMindState ? currentMindState.affinity : 10.0;
    const currentTrustDepth = currentMindState ? currentMindState.trust_depth : 0.05;
    const currentMomentum = currentMindState ? currentMindState.momentum : 0.0;

    isEvaluating = true;
    lastEvaluatedMessageId = targetIdx;

    try {
        const evaluator = new JevEvaluator(apiKey);
        const evaluation = await evaluator.evaluateTurn(
            {
                name: characterName,
                personality,
                description,
                mes_examples: mesExamples,
                system_prompt: systemPrompt,
            },
            userMessage,
            lastMessage.mes,
            null,
            FETCH_TIMEOUT_MS
        );

        const personalityProfile = getCharacterPersonalityProfile(context.characterId);
        const dynamics = new AffinityDynamicsEngine(currentAffinity, currentTrustDepth, currentMomentum, personalityProfile);
        const turnReport = dynamics.processTurn(evaluation);

        const data = {
            ...turnReport,
            tts_style: evaluation.tts_style,
        };

        const s = getSettings();
        const binding = getCharacterMacroBinding(characterName);

        // 同步酒馆全局变量宏
        if (typeof context.executeSlashCommands === 'function') {
            await context.executeSlashCommands(`/setvar key=${binding.affinity} ${data.new_affinity}`);
            await context.executeSlashCommands(`/setvar key=${binding.stage} ${data.stage}`);
            if (binding.affinity !== 'affinity') await context.executeSlashCommands(`/setvar key=affinity ${data.new_affinity}`);
            if (binding.stage !== 'relationship_stage') await context.executeSlashCommands(`/setvar key=relationship_stage ${data.stage}`);

            // 立绘微表情差分联动
            if (s.enableExpressions && data.expression) {
                await context.executeSlashCommands(`/expression-set ${data.expression}`);
            }

            // 世界书广播标签静默注入
            if (s.enableInjection) {
                const injectTag = buildBilingualInjectTag(data);
                const safeTag = escapeForSlash(injectTag);
                await context.executeSlashCommands(`/inject id="tavern-mind" position=chat depth=1 value="${safeTag}"`);
            }
        }

        // 角色卡持久化写盘
        if (hasSignificantChange(data, currentMindState)) {
            await saveCharacterMindState(context.characterId, data);
        }

        // HUD 悬浮罗盘更新
        updateHudDisplay(data, data.actual_delta);

        // Toastr 通知
        if (window.toastr && data.actual_delta !== 0) {
            const deltaStr = data.actual_delta > 0 ? `+${data.actual_delta.toFixed(2)}` : `${data.actual_delta.toFixed(2)}`;
            const toastTitle = t('toast_fluctuation_title', { name: characterName });
            const toastBody = t('toast_fluctuation_body', {
                aff: data.new_affinity.toFixed(2),
                delta: deltaStr,
                def: (data.defense_prob * 100).toFixed(0),
                tru: (data.trust_depth * 100).toFixed(0),
                expr: data.expression,
            });
            window.toastr.info(toastBody, toastTitle, { timeOut: 4000 });
        }
    } catch (err) {
        console.warn(`[${MODULE_NAME}] Jev 判定异常:`, err);
        if (window.toastr) {
            window.toastr.warning(`Jev: ${err.message}`, t('drawer_title'), { timeOut: 6000 });
        }
    } finally {
        isEvaluating = false;
    }
}

// 核心初始化入口
jQuery(async () => {
    console.log(`[${MODULE_NAME}] 初始化「灵犀」(Mind Compass) v2.1.0...`);

    // 1. 挂载 HUD
    ensureHudMounted();

    // 2. 挂载设置抽屉
    await loadSettingsDrawer();

    // 3. 初始同步角色档案
    onContextSync();

    // 4. 监听酒馆生命周期事件
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
        evaluateMessage(messageId);
    });

    eventSource.on(event_types.MESSAGE_SWIPED, (messageId) => {
        evaluateMessage(messageId);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        onContextSync();
        populateMacroSelector();
    });

    if (event_types.CHARACTERS_LOADED) {
        eventSource.on(event_types.CHARACTERS_LOADED, () => {
            populateMacroSelector();
        });
    }

    if (event_types.CHARACTER_SELECTED) {
        eventSource.on(event_types.CHARACTER_SELECTED, () => {
            onContextSync();
            populateMacroSelector();
        });
    }

    // 5. 语言切换时自动重绘国际化
    if (window.i18next && typeof window.i18next.on === 'function') {
        window.i18next.on('languageChanged', () => {
            applyLocalization($('#mind_engine_settings'));
            applyLocalization($('#jev-mind-hud'));
        });
    }

    console.log(`[${MODULE_NAME}] 「灵犀」(Mind Compass) 扩展已完全就绪！`);
});
