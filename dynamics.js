/**
 * Tavern Mind Engine — 确定性双轨动力学引擎 (v2.0 Pure JS)
 * 基于 TypeSafe Jev 复合评分 (Composite Scoring) + 一阶低通滤波 (Leaky Filter) + 洋葱模型双轨积分。
 * 纯数学实现，零网络依赖。
 */

// ========== 关系阶段分层 ==========

export const STAGES = {
    ESTRANGED:    '疏离反感', // < 0
    STRANGER:     '初见戒备', // 0 ~ 19.9
    ACQUAINTANCE: '浅层试探', // 20 ~ 39.9
    TRUSTED:      '建立信任', // 40 ~ 59.9
    ATTACHED:     '情感倾斜', // 60 ~ 79.9
    SOULBOUND:    '灵魂共鸣', // 80 ~ 100
};

const STAGE_ALIASES = {
    '疏离反感': 'Estranged/Hostile | 反感 | 敌意 | hostile | estranged',
    '初见戒备': 'Stranger/Guarded | 初见 | 陌生 | 戒备 | stranger | guarded | distant',
    '浅层试探': 'Acquaintance/Curious | 相识 | 破冰 | 改观 | acquaintance | curious',
    '建立信任': 'Trusted/Friend | 信任 | 朋友 | 好感 | trusted | friend | trusting',
    '情感倾斜': 'Affectionate/Crush | 亲密 | 喜欢 | 暧昧 | 心动 | affectionate | crush',
    '灵魂共鸣': 'Soulbound/Devoted | 恋人 | 深爱 | 沦陷 | lover | devoted | soulbound',
};

export function getStage(affinity) {
    if (affinity < 0)   return STAGES.ESTRANGED;
    if (affinity < 20)  return STAGES.STRANGER;
    if (affinity < 40)  return STAGES.ACQUAINTANCE;
    if (affinity < 60)  return STAGES.TRUSTED;
    if (affinity < 80)  return STAGES.ATTACHED;
    return STAGES.SOULBOUND;
}

export function getStageAliases(stage) {
    return STAGE_ALIASES[stage] || '';
}

// ========== 动力学引擎 ==========

export class AffinityDynamicsEngine {
    // 各阶段突破门禁点与对应的最低核心信任深度 (TrustDepth) 要求
    static TIER_BOTTLENECKS = [
        { threshold: 19.9, reqTrust: 0.20 }, // 初见戒备 -> 浅层试探: 要求信任 >= 0.20 (心防 <= 80%)
        { threshold: 39.9, reqTrust: 0.40 }, // 浅层试探 -> 建立信任: 要求信任 >= 0.40 (心防 <= 60%)
        { threshold: 59.9, reqTrust: 0.60 }, // 建立信任 -> 情感倾斜: 要求信任 >= 0.60 (心防 <= 40%)
        { threshold: 79.9, reqTrust: 0.80 }, // 情感倾斜 -> 灵魂共鸣: 要求信任 >= 0.80 (心防 <= 20%)
    ];

    /**
     * @param {number} [initialAffinity=10.0] - 初始好感度 (-20 ~ 100)
     * @param {number|null} [initialTrustDepth=null] - 初始核心信任深度 (0.00 ~ 1.00)，若为 null 则由 baseline_defense 确定
     * @param {number} [initialMomentum=0.0] - 初始情绪动量 (-2.0 ~ +2.0)
     * @param {object|null} [personalityProfile=null] - 性格心智动力学特征画像 (连续特征，无死板分类)
     */
    constructor(initialAffinity = 10.0, initialTrustDepth = null, initialMomentum = 0.0, personalityProfile = null) {
        this.profile = AffinityDynamicsEngine.normalizeProfile(personalityProfile);

        // 若未显式指定 initialTrustDepth，由 1.0 - baseline_defense 科学确定
        const defaultTrust = Math.max(0.0, Math.min(1.0, +(1.0 - this.profile.baseline_defense).toFixed(2)));
        const finalTrust = (typeof initialTrustDepth === 'number' && !isNaN(initialTrustDepth)) ? initialTrustDepth : defaultTrust;

        this.affinity = Math.max(-20, Math.min(100, +Number(initialAffinity).toFixed(2)));
        this.trustDepth = Math.max(0.0, Math.min(1.0, +Number(finalTrust).toFixed(2)));
        this.momentum = Math.max(-2.0, Math.min(2.0, +Number(initialMomentum).toFixed(2)));
        this.history = [];
    }

    /**
     * 规范化性格心智画像，确保无 NaN 且落于严密闭区间
     */
    static normalizeProfile(profile) {
        const p = profile || {};
        return {
            flattery_resistance: typeof p.flattery_resistance === 'number' && !isNaN(p.flattery_resistance)
                ? Math.max(0.0, Math.min(1.0, +p.flattery_resistance.toFixed(2)))
                : 0.50,
            vulnerability_need: typeof p.vulnerability_need === 'number' && !isNaN(p.vulnerability_need)
                ? Math.max(0.5, Math.min(2.0, +p.vulnerability_need.toFixed(2)))
                : 1.00,
            baseline_defense: typeof p.baseline_defense === 'number' && !isNaN(p.baseline_defense)
                ? Math.max(0.10, Math.min(0.95, +p.baseline_defense.toFixed(2)))
                : 0.80,
        };
    }

    /**
     * 热更新性格动力学画像
     */
    setPersonalityProfile(profile) {
        this.profile = AffinityDynamicsEngine.normalizeProfile(profile);
    }

    /**
     * 消费 Jev 6 维原子裁决概率，执行连续动力学结算
     * @param {object} evaluation - JevEvaluator 返回的裁决字典
     * @returns {object} 状态变动结算报告
     */
    processTurn(evaluation) {
        const pViolate = evaluation.boundary_violation_prob ?? 0.0;
        const pFlatter = evaluation.flattery_prob ?? 0.0;
        const pWit = evaluation.wit_prob ?? 0.0;
        const pVal = evaluation.validation_prob ?? 0.0;
        const pVuln = evaluation.vulnerability_prob ?? 0.0;
        const expression = evaluation.expression || 'neutral';
        const powerScore = evaluation.power_score ?? 2.0;

        // 1. 连续复合刺激合成 (Composite Stimulus, S)
        // 动态计算奉承项反馈：
        let flatteryTerm = 0.0;
        if (this.profile.flattery_resistance >= 0.50) {
            // 高奉承抗性：严厉倒扣，抗性越高扣罚越重 (-0.35 ~ -0.75)
            const penaltyRate = 0.35 + (this.profile.flattery_resistance - 0.50) * 0.80;
            flatteryTerm = -(penaltyRate * pFlatter);
        } else if (this.profile.flattery_resistance < 0.30) {
            // 低奉承抗性（渴望认可/单纯）：不倒扣，反而带来微小愉悦反馈 (+0.00 ~ +0.15)
            const bonusRate = (0.30 - this.profile.flattery_resistance) * 0.50;
            flatteryTerm = +(bonusRate * pFlatter);
        } else {
            // 中等抗性 (0.30 ~ 0.50)：温和轻微扣分 (-0.20 ~ -0.35)
            const penaltyRate = 0.20 + (this.profile.flattery_resistance - 0.30) * 0.75;
            flatteryTerm = -(penaltyRate * pFlatter);
        }

        // 脆弱暴露刺激：由 vulnerability_need 动态加权 (0.50 ~ 2.00)
        const vulnWeight = 1.20 * this.profile.vulnerability_need;
        const vulnTerm = vulnWeight * pVuln;

        // 机敏接梗(+0.25) + 共情接纳(+0.50) + 脆弱暴露(动态加权) - 越界冒犯(-1.60) + 谄媚项(动态符号)
        let rawStimulus = (0.25 * pWit) + (0.50 * pVal) + vulnTerm 
                          - (1.60 * pViolate) + flatteryTerm;
        rawStimulus = +rawStimulus.toFixed(3);

        // 2. 一阶低通惯性滤波 (更新瞬时情绪动量，保留前序温热感，根除单帧断崖)
        // 滤波惯性系数 alpha = 0.65
        const alpha = 0.65;
        this.momentum = +(alpha * this.momentum + (1.0 - alpha) * rawStimulus).toFixed(3);
        this.momentum = Math.max(-2.0, Math.min(2.0, this.momentum));

        // 3. 社会渗透洋葱模型 (深层核心信任与心防护盾解构)
        // 闲聊与普通赞美只停留在外层，绝不磨损深层防御！
        // 唯有真诚的脆弱性暴露 (pVuln > 0.35 且未严重违规) 方可穿透核心
        if (pVuln > 0.35 && pViolate < 0.25) {
            const trustGain = pVuln * (1.0 - pViolate) * 0.25;
            this.trustDepth = Math.min(1.0, +(this.trustDepth + trustGain).toFixed(2));
        }

        // 严重越界冒犯导致核心信任崩塌与心防激化
        if (pViolate > 0.50) {
            const trustLoss = pViolate * 0.25;
            this.trustDepth = Math.max(0.0, +(this.trustDepth - trustLoss).toFixed(2));
        }

        // 实时心防概率：由 1.0 - trustDepth 严密确定 (最低保留 5% 固有底线防卫)
        const defenseProb = Math.max(0.05, +(1.0 - this.trustDepth).toFixed(2));

        // 4. 计算好感度增量 (结合心防阻尼与动量驱动)
        let delta = 0.0;
        if (rawStimulus > 0) {
            // 正向刺激：心防阻尼 (心防越高吸收越少，最低保留 20%)
            const damping = Math.max(0.20, 1.0 - defenseProb * 0.75);
            // 结合当前刺激与动量加权
            delta = +((rawStimulus * 0.75 + this.momentum * 0.25) * damping).toFixed(2);
        } else if (rawStimulus < 0) {
            // 负向刺激：心防越高惩罚越重 (最高放大 150%)
            const penalty = 1.0 + defenseProb * 0.50;
            delta = +(rawStimulus * penalty).toFixed(2);
        } else {
            // 纯中性/日常事务性输入 (rawStimulus === 0)
            // 若前序动量依然温热 (momentum > 0.15)，释放微弱情感余温，绝不瞬间冰封
            if (this.momentum > 0.15) {
                delta = +(this.momentum * 0.20 * Math.max(0.20, 1.0 - defenseProb)).toFixed(2);
            } else {
                delta = 0.0;
            }
        }

        // 5. 门禁瓶颈判定 (基于 TrustDepth 进行科学破关检验，根除死锁)
        let bottleneckLocked = false;
        let targetAffinity = +(this.affinity + delta).toFixed(2);

        for (const gate of AffinityDynamicsEngine.TIER_BOTTLENECKS) {
            if (this.affinity <= gate.threshold && gate.threshold < targetAffinity) {
                if (this.trustDepth < gate.reqTrust) {
                    // 核心信任未达标，触发关卡门禁阻断，好感卡在关卡点
                    targetAffinity = gate.threshold;
                    bottleneckLocked = true;
                    break;
                }
                // 核心信任已达标，平滑放行，实现阶段质变突破
            }
        }

        // 限制在 [-20, 100] 闭区间
        targetAffinity = Math.max(-20.0, Math.min(100.0, targetAffinity));
        const actualDelta = +(targetAffinity - this.affinity).toFixed(2);

        const oldStage = getStage(this.affinity);
        const oldAffinity = this.affinity;
        this.affinity = targetAffinity;
        const newStage = getStage(this.affinity);

        const turnReport = {
            old_affinity: oldAffinity,
            new_affinity: this.affinity,
            actual_delta: actualDelta,
            raw_stimulus: rawStimulus,
            momentum: this.momentum,
            trust_depth: this.trustDepth,
            defense_prob: defenseProb,
            bottleneck_locked: bottleneckLocked,
            stage: newStage,
            stage_aliases: getStageAliases(newStage),
            expression,
            power_score: powerScore,
            personality_profile: { ...this.profile },
            stage_changed: oldStage !== newStage,
        };

        this.history.push(turnReport);
        return turnReport;
    }
}
