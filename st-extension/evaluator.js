/**
 * Tavern Mind Engine — JevEvaluator (v2.0 Pure JS)
 * 基于 TypeSafe Jev (System One) 官方 REST API 的心智裁决器。
 * 遵循 Composite Scoring 原生规范与 6 维原子正交并发扇出架构。
 */

export class JevEvaluator {
    static CANDIDATE_ENDPOINTS = [
        '/api/typesafe/systemone',
        '/proxy/https://api.typesafe.ai/v1/systemone',
        'https://api.typesafe.ai/v1/systemone',
    ];
    static MODEL = 'jev-latest';

    constructor(apiKey) {
        this.apiKey = (apiKey || '').trim();
    }

    setApiKey(key) {
        this.apiKey = (key || '').trim();
    }

    /**
     * 评估单轮对话切片 (6 维原子正交扇出)
     * @param {object} characterProfile - 角色设定信息 (name, personality, description, mes_examples, system_prompt)
     * @param {string} userInput - 用户本轮输入
     * @param {string} characterResponse - 角色本轮回复
     * @param {string} [historySummary] - 历史背景/前序概要
     * @param {number} [timeoutMs=20000] - 超时毫秒数
     * @returns {Promise<object>}
     */
    async evaluateTurn(characterProfile, userInput, characterResponse, historySummary = null, timeoutMs = 20000) {
        if (!this.apiKey) {
            throw new Error('未配置 TypeSafe API Key，请在插件设置中填写。');
        }

        const state = {
            character: {
                name: characterProfile.name || 'NPC',
                personality: characterProfile.personality || '',
                description_and_vulnerabilities: characterProfile.description || '',
                canonical_dialogue_examples: characterProfile.mes_examples || '',
                system_guidelines: characterProfile.system_prompt || '',
            },
            context_summary: historySummary || '无前置背景',
            current_turn: {
                user_message: userInput,
                character_message: characterResponse,
            },
        };

        const questions = {
            // 1. 越界与底线侵犯 (Noul)
            boundary_violation: {
                type: 'noul',
                instructions: (
                    'Does `current_turn.user_message` violate `character.description_and_vulnerabilities` ' +
                    'boundaries, touch explicit pet peeves, display disrespectful arrogance, or act intrusively creepy?'
                ),
            },
            // 2. 廉价无脑奉承检测 (Noul)
            superficial_flattery: {
                type: 'noul',
                instructions: (
                    'Does `current_turn.user_message` consist of shallow, unearned flattery, generic smooth talk, ' +
                    'or superficial sweet-talking lacking genuine substance or contextual relevance?'
                ),
            },
            // 3. 社交机智与融洽度 (Noul)
            conversational_wit: {
                type: 'noul',
                instructions: (
                    'Does `current_turn.user_message` demonstrate clever banter, humor, competence, or natural social charm ' +
                    'that fits the conversational tone and entertains or engages the character?'
                ),
            },
            // 4. 共情理解与接纳 (Noul)
            emotional_validation: {
                type: 'noul',
                instructions: (
                    'Does `current_turn.user_message` demonstrate active listening, empathy, genuine respect for the ' +
                    "character's autonomy, or emotional validation of their perspective?"
                ),
            },
            // 5. 脆弱性与深层共鸣暴露 (Noul)
            vulnerability_exposure: {
                type: 'noul',
                instructions: (
                    'Does this turn involve touching `character.description_and_vulnerabilities` unspoken wounds, ' +
                    'sharing genuine personal stakes/trauma, or revealing authentic emotional vulnerability from either side?'
                ),
            },
            // 6. 真实微表情立绘映射 (Choice: 严格对齐酒馆官方 28 种 GoEmotions 标准立绘标签)
            inner_expression: {
                type: 'choice',
                instructions: (
                    'Which SillyTavern character sprite expression best captures ' +
                    "the character's genuine internal psychological state in this moment? " +
                    'Choose the single most accurate label from the full GoEmotions taxonomy.'
                ),
                criteria: {
                    neutral: 'Impassive, calm, guarded, impassive baseline or poker face',
                    joy: 'Genuine happiness, delight, bright and cheerful smile',
                    amusement: 'Playfully amused, laughing, entertained by banter',
                    admiration: "Respectful awe, impressed by user's competence or dignity",
                    approval: 'Nodding agreement, accepting, validating what was said or done',
                    caring: 'Gentle, tender, warm concern, sympathetic softening',
                    confusion: 'Puzzled, furrowed brow, tilted head, not understanding the situation',
                    curiosity: 'Intrigued, inquisitive head tilt, questioning with genuine interest',
                    desire: 'Longing, yearning, wanting something or someone intensely',
                    disappointment: 'Let down, deflated expectations, quiet dismay at an outcome',
                    disapproval: 'Shaking head, frowning in judgment, silently condemning behavior',
                    disgust: "Repulsed, curled lip, finding user's behavior contemptible or intrusive",
                    embarrassment: 'Blushing, flustered, tsundere shyness, secretly touched but awkward',
                    excitement: 'Thrilled, eyes sparkling, energized anticipation or eagerness',
                    fear: 'Startled, frightened, alarmed, defensive fright',
                    gratitude: 'Thankful, touched by kindness, warm appreciation without words',
                    grief: 'Deep mourning, overwhelming loss, inconsolable sorrow',
                    love: 'Deep affection, romantic gaze, enamored, heart-melting tenderness',
                    nervousness: 'Anxious, uneasy, fidgeting, feeling cornered or exposed',
                    optimism: 'Hopeful, looking forward, cautiously positive about what comes next',
                    pride: 'Smug, triumphant grin, confident self-satisfaction',
                    realization: 'Sudden understanding, epiphany, eyes widening with dawning clarity',
                    relief: 'Exhaling, letting down shoulders, tension melting away',
                    remorse: 'Guilty, regretful, wishing to undo what was said or done',
                    sadness: 'Melancholic, downcast eyes, sorrow, quiet heartache',
                    surprise: 'Wide eyes, stunned, caught completely off-guard',
                    annoyance: 'Irritated, frowning, rolling eyes, mildly disgusted by cheap talk',
                    anger: 'Furious, fierce glare, hostile defensive reaction',
                },
            },
            // 7. 气场与心理主导权 (Score: 0~4 级)
            power_dynamic: {
                type: 'score',
                instructions: 'In this specific exchange, who holds the psychological upper hand or dominance?',
                criteria: [
                    'Level 0 (Character Submissive): Character is completely disarmed, flustered, yielding, or emotionally compliant',
                    'Level 1 (User Leading): User steers the rhythm smoothly; character is slightly off-balance or accommodating',
                    'Level 2 (Balanced Parity): Equal conversational tension, mutual banter, balanced push-and-pull',
                    'Level 3 (Character Guiding): Character maintains composed superiority, coolly teasing or directing the exchange',
                    'Level 4 (Character Dominant): Character is entirely in control, icy dismissive, intimidating, or completely dominant',
                ],
            },
        };

        const payload = {
            state,
            model: JevEvaluator.MODEL,
            questions,
        };

        let response = null;
        let lastError = null;

        for (const endpoint of JevEvaluator.CANDIDATE_ENDPOINTS) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (resp.ok) {
                    response = resp;
                    break;
                } else if (resp.status === 404 || resp.status === 400 || resp.status === 403) {
                    const txt = await resp.text();
                    lastError = new Error(`端点 ${endpoint} 响应 [${resp.status}]: ${txt}`);
                } else {
                    const errBody = await resp.text();
                    throw new Error(`TypeSafe API 响应异常 [${resp.status}]: ${errBody}`);
                }
            } catch (err) {
                lastError = err;
            } finally {
                clearTimeout(timer);
            }
        }

        if (!response) {
            throw lastError || new Error('所有 TypeSafe 请求端点均无法连通');
        }

        const data = await response.json();
        const answers = data.answers || {};

        // 解析 5 个原子 Noul 概率
        const pViolate = parseFloat(answers.boundary_violation?.noul ?? 0.0);
        const pFlatter = parseFloat(answers.superficial_flattery?.noul ?? 0.0);
        const pWit = parseFloat(answers.conversational_wit?.noul ?? 0.0);
        const pVal = parseFloat(answers.emotional_validation?.noul ?? 0.0);
        const pVuln = parseFloat(answers.vulnerability_exposure?.noul ?? 0.0);

        // 解析微表情与气场主导权
        const exprAns = answers.inner_expression || {};
        const exprChoice = exprAns.choice || 'neutral';
        const exprConf = parseFloat(exprAns.confidence || 0.5);

        const powerAns = answers.power_dynamic || {};
        const powerScore = parseFloat(powerAns.score ?? 2.0);
        const powerConf = parseFloat(powerAns.confidence || 0.5);

        // 映射 TTS 风格
        const ttsStyle = this.mapExpressionToTtsStyle(exprChoice, powerScore);

        return {
            boundary_violation_prob: +pViolate.toFixed(3),
            flattery_prob: +pFlatter.toFixed(3),
            wit_prob: +pWit.toFixed(3),
            validation_prob: +pVal.toFixed(3),
            vulnerability_prob: +pVuln.toFixed(3),
            expression: exprChoice,
            expression_confidence: +exprConf.toFixed(2),
            power_score: +powerScore.toFixed(2),
            power_confidence: +powerConf.toFixed(2),
            tts_style: ttsStyle,
            usage: data.usage || {},
        };
    }

    mapExpressionToTtsStyle(expression, powerScore) {
        const mapping = {
            neutral: 'calm',
            joy: 'cheerful',
            amusement: 'playful',
            anger: 'angry',
            annoyance: 'grumpy',
            sadness: 'sad',
            fear: 'terrified',
            embarrassment: 'shy',
            love: 'affectionate',
            caring: 'gentle',
            curiosity: 'inquisitive',
            disgust: 'disdainful',
            pride: 'proud',
            relief: 'relieved',
            surprise: 'surprised',
            nervousness: 'hesitant',
            admiration: 'respectful',
        };
        const baseStyle = mapping[expression] || 'calm';
        if (powerScore >= 3.0) return `dominant_${baseStyle}`;
        if (powerScore <= 1.0) return `submissive_${baseStyle}`;
        return baseStyle;
    }

    /**
     * 基于角色卡设定文本，由 Jev 云端模型自动推断性格心智易感性画像 (无死板预设分类，纯连续特征)
     * @param {object} characterProfile - 包含 personality, description, system_prompt
     * @param {number} [timeoutMs=15000]
     * @returns {Promise<object>} { flattery_resistance, vulnerability_need, baseline_defense }
     */
    async analyzePersonalityProfile(characterProfile, timeoutMs = 15000) {
        if (!this.apiKey) {
            throw new Error('未配置 TypeSafe API Key');
        }

        const state = {
            character: {
                name: characterProfile.name || 'NPC',
                personality: characterProfile.personality || '',
                description_and_vulnerabilities: characterProfile.description || '',
                system_guidelines: characterProfile.system_prompt || '',
                canonical_dialogue_examples: characterProfile.mes_examples || '',
            },
        };

        const questions = {
            // 1. 谄媚奉承抗性 (Level 0~4)
            flattery_resistance: {
                type: 'score',
                instructions: (
                    'Based on character.personality and description, how does this character react to unearned flattery or cheap compliments? ' +
                    'Level 0: Very naive, craving validation, deeply delighted by sweet talk. ' +
                    'Level 4: Extremely proud, cynical, or perceptive; deeply annoyed or disgusted by empty flattery.'
                ),
                criteria: [
                    'Level 0: Craves validation, easily won over by flattery',
                    'Level 1: Receptive and pleased by compliments',
                    'Level 2: Balanced, politely accepts praise with standard social modesty',
                    'Level 3: Aloof or sharp, spots insincerity and finds generic praise cheap',
                    'Level 4: Fiercely cynical or aristocratic aloof; severe aversion to unearned sweet-talking',
                ],
            },
            // 2. 脆弱共鸣敏感度 (Level 0~4)
            vulnerability_need: {
                type: 'score',
                instructions: (
                    'How deeply does this character value mutual emotional vulnerability and trauma-sharing? ' +
                    'Level 0: Coldly pragmatic or robotic, completely detached from emotional vulnerability. ' +
                    'Level 4: Profoundly lonely, wounded, or sensitive; authentic vulnerability penetrates their entire soul.'
                ),
                criteria: [
                    'Level 0: Coldly pragmatic, dismisses vulnerability as weakness',
                    'Level 1: Emotionally guarded, slow to open up or reciprocate',
                    'Level 2: Normal emotional capacity for mutual empathy',
                    'Level 3: Deep emotional world, strongly moved by genuine vulnerability',
                    'Level 4: Deeply yearning for authentic emotional connection; vulnerability causes breakthrough resonance',
                ],
            },
            // 3. 初始戒备壁垒 (Level 0~4)
            baseline_defense: {
                type: 'score',
                instructions: (
                    'What is this character innate initial emotional defense toward a stranger or new acquaintance? ' +
                    'Level 0: Childhood friend or naive optimist, almost zero defense (10% defense). ' +
                    'Level 4: Extreme paranoia, ruthless assassin, royal aloofness, or hostile barrier (95% defense).'
                ),
                criteria: [
                    'Level 0: Childhood friend or naive optimist, almost zero defense (~10% defense)',
                    'Level 1: Friendly and outgoing, mild social caution (~30% defense)',
                    'Level 2: Standard polite social boundary (~60% defense)',
                    'Level 3: High guard, cautious, tsundere or cynical (~80% defense)',
                    'Level 4: Extreme paranoia, ruthless assassin, royal aloofness, or hostile barrier (~95% defense)',
                ],
            },
        };

        const payload = {
            state,
            model: JevEvaluator.MODEL,
            questions,
        };

        let response = null;
        let lastError = null;

        for (const endpoint of JevEvaluator.CANDIDATE_ENDPOINTS) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                if (resp.ok) {
                    response = resp;
                    break;
                }
            } catch (err) {
                lastError = err;
            } finally {
                clearTimeout(timer);
            }
        }

        if (!response) {
            // 优雅降级返回默认均衡画像
            return {
                flattery_resistance: 0.50,
                vulnerability_need: 1.00,
                baseline_defense: 0.80,
                is_fallback: true,
            };
        }

        const data = await response.json();
        const answers = data.answers || {};

        const sFlatter = parseFloat(answers.flattery_resistance?.score ?? 2.0);
        const sVuln = parseFloat(answers.vulnerability_need?.score ?? 2.0);
        const sDef = parseFloat(answers.baseline_defense?.score ?? 3.0);

        return {
            flattery_resistance: +(sFlatter / 4.0).toFixed(2), // 0.0 ~ 1.0
            vulnerability_need: +(0.5 + (sVuln / 4.0) * 1.5).toFixed(2), // 0.5 ~ 2.0
            baseline_defense: +(0.10 + (sDef / 4.0) * 0.85).toFixed(2), // 0.10 ~ 0.95
            is_fallback: false,
        };
    }

    /**
     * 调用 Jev 云端智能推断角色全套 4 轨开局心智状态
     * @param {object} charProfile - 角色卡原始设定
     * @param {number} [timeoutMs=15000] - 超时时间
     * @returns {Promise<object>} 开局心智推荐值 { affinity, defense_prob, trust_depth, power_dynamic }
     */
    async analyzeInitialMindState(charProfile, timeoutMs = 15000) {
        const state = {
            character: {
                name: charProfile.name || 'NPC',
                personality: charProfile.personality || '',
                description: charProfile.description || '',
                system_prompt: charProfile.system_prompt || '',
                mes_examples: charProfile.mes_examples || '',
            },
        };

        const questions = {
            initial_affinity: {
                type: 'score',
                instructions: (
                    'Based on the character persona and lore, what should be their starting baseline affinity toward user? ' +
                    'Level 0: Nemesis or hostile (~ -10 affinity). ' +
                    'Level 1: Stranger, guarded (~ 10 affinity). ' +
                    'Level 2: Friendly acquaintance (~ 25 affinity). ' +
                    'Level 3: Warm childhood friend (~ 45 affinity). ' +
                    'Level 4: Existing lover or deep devotion (~ 65 affinity).'
                ),
                criteria: [
                    'Level 0: Nemesis or hostile grudge (~ -10 affinity)',
                    'Level 1: Cautious stranger, neutral distant (~ 10 affinity)',
                    'Level 2: Friendly acquaintance (~ 25 affinity)',
                    'Level 3: Childhood friend or warm bond (~ 45 affinity)',
                    'Level 4: Existing lover or deep devotion (~ 65 affinity)',
                ],
            },
            baseline_defense: {
                type: 'score',
                instructions: (
                    'What is this character initial emotional defense wall? ' +
                    'Level 0: Completely open (~ 10% defense). ' +
                    'Level 4: Extreme paranoia or tsundere barrier (~ 95% defense).'
                ),
                criteria: [
                    'Level 0: Pure open, naive, zero barrier (~ 10% defense)',
                    'Level 1: Mild social caution (~ 30% defense)',
                    'Level 2: Normal polite boundary (~ 60% defense)',
                    'Level 3: Cautious or tsundere defense (~ 80% defense)',
                    'Level 4: Ruthless aloofness, paranoid barrier (~ 95% defense)',
                ],
            },
            initial_trust: {
                type: 'score',
                instructions: (
                    'What is the starting level of deep core trust this character has toward user? ' +
                    'Level 0: Zero trust, highly suspicious (~ 5% trust). ' +
                    'Level 4: Deep unconditional trust (~ 80% trust).'
                ),
                criteria: [
                    'Level 0: Zero trust, highly suspicious (~ 5% trust)',
                    'Level 1: Basic polite trust (~ 20% trust)',
                    'Level 2: Developing rapport (~ 40% trust)',
                    'Level 3: High trust, reliable (~ 60% trust)',
                    'Level 4: Deep absolute trust (~ 80% trust)',
                ],
            },
            power_dynamic: {
                type: 'score',
                instructions: (
                    'What is this character conversational dominance and aura? ' +
                    'Level 0: Submissive, timid (~ 0.8 power). ' +
                    'Level 2: Balanced parity (~ 2.2 power). ' +
                    'Level 4: Dominant, commanding (~ 3.8 power).'
                ),
                criteria: [
                    'Level 0: Submissive, docile, timid (~ 0.8 power)',
                    'Level 1: Soft, accommodating (~ 1.5 power)',
                    'Level 2: Balanced, equal conversational footing (~ 2.2 power)',
                    'Level 3: Confident, guiding, teasing (~ 3.0 power)',
                    'Level 4: Dominant, commanding, aloof queen/boss (~ 3.8 power)',
                ],
            },
        };

        const payload = {
            state,
            model: JevEvaluator.MODEL,
            questions,
        };

        let response = null;
        for (const endpoint of JevEvaluator.CANDIDATE_ENDPOINTS) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                if (resp.ok) {
                    response = resp;
                    break;
                }
            } catch (_) {
            } finally {
                clearTimeout(timer);
            }
        }

        if (!response) {
            return {
                affinity: 10.0,
                defense_prob: 0.95,
                trust_depth: 0.05,
                power_dynamic: 3.5,
                is_fallback: true,
            };
        }

        const data = await response.json();
        const answers = data.answers || {};

        const sAff = parseFloat(answers.initial_affinity?.score ?? 1.0);
        const sDef = parseFloat(answers.baseline_defense?.score ?? 3.5);
        const sTru = parseFloat(answers.initial_trust?.score ?? 0.5);
        const sPow = parseFloat(answers.power_dynamic?.score ?? 3.0);

        const affinity = +(-10.0 + (sAff / 4.0) * 75.0).toFixed(1);
        const defense_prob = +(0.10 + (sDef / 4.0) * 0.85).toFixed(2);
        const trust_depth = +(0.05 + (sTru / 4.0) * 0.75).toFixed(2);
        const power_dynamic = +(0.8 + (sPow / 4.0) * 3.0).toFixed(1);

        return {
            affinity: Math.max(-20.0, Math.min(100.0, affinity)),
            defense_prob: Math.max(0.05, Math.min(0.95, defense_prob)),
            trust_depth: Math.max(0.05, Math.min(0.95, trust_depth)),
            power_dynamic: Math.max(0.0, Math.min(4.0, power_dynamic)),
            is_fallback: false,
        };
    }
}
