import type { TutorialData } from '../types';

// 论文原图统一走 Vite 基址前缀。部署到 GitHub Pages 的子路径
// （/PaperSkill/papers/<paper>/<version>/）时绝对路径 /images/... 会指向域名根而失效。
const fig = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

// ============================================================================
//  DAME-Net Tutorial Data
//  Paper: Compositional-Degradation UAV Image Restoration: Conditional Decoupled MoE Network and A Benchmark
//  Theme: Photography Practice (摄影练习)
// ============================================================================

export const tutorial: TutorialData = {
  meta: {
    titleEn: 'Compositional-Degradation UAV Image Restoration: Conditional Decoupled MoE Network and A Benchmark',
    titleZh: '组合退化无人机图像修复：条件解耦MoE网络与基准',
    venue: 'arXiv 2026',
    authors: 'Jinquan Yan, Zhicheng Zhao, Zhengzheng Tu, Chenglong Li, Jin Tang, Bin Luo',
    affiliation: '安徽大学',
    domain: '图像修复、无人机、混合专家',
    coreProblem: 'UAV图像在真实飞行环境中常受多种退化因素（雨、雾、噪声等）同时影响，现有统一修复方法使用隐式退化表示导致因子间干扰',
    coreInsight: 'DAME-Net通过显式退化感知（FDPM）和条件解耦MoE修复（CDMM），实现选择性因子级校正',
    keywords: ['图像修复', '组合退化', '混合专家', '无人机'],
  },
  hero: {
    oldMethod: {
      desc: '隐式统一修复：将多种退化压缩为单一整体条件，导致因子间干扰和修复质量下降',
      figure: fig('blind_restoration.png'),
      componentId: 'hero-condition-compare'
    },
    newMethod: {
      desc: 'DAME-Net显式解耦：显式感知每种退化因子，条件引导选择性修复，避免干扰',
      figure: fig('framework.png'),
      componentId: 'hero-condition-compare'
    },
  },
  chapters: [
    // Chapter 1: 问题与核心循环
    {
      kind: 'chapter',
      id: 'chap-1',
      title: '问题：多重退化的挑战',
      badge: 'inf',
      badgeLabel: '基础',
      bridge: '在真实飞行环境中，UAV图像很少只受单一退化影响。雨、雾、噪声、模糊等多种因素常常同时出现，严重影响图像质量和下游任务性能。',
      analogy: {
        title: '检查受损照片',
        text: '就像摄影师检查一张模糊、曝光过度且有噪声的照片一样，我们需要识别图像中的所有问题。',
        componentId: 'degradation-inspector'
      },
      modules: [
        {
          kind: 'module',
          id: '1.1',
          title: '退化识别器',
          desc: '点击选择不同的退化类型，观察它们叠加后对图像的影响。画布会标出当前激活的退化因子与数量，帮助理解组合退化的复杂性。',
          figure: fig('wrong_detect.png'),
          componentId: 'degradation-inspector'
        }
      ],
      insight: '组合退化不是单一退化的简单叠加——它们的交互会联合扭曲结构、对比度和局部纹理，使修复变得更加困难。',
      takeaways: [
        { icon: '🎯', title: '多重退化', desc: 'UAV图像常受雨、雾、噪声等多种退化因素同时影响' },
        { icon: '🔧', title: '组合复杂性', desc: '不同退化类型需要不同的修复方法，组合情况更复杂' },
        { icon: '✨', title: '下游影响', desc: '退化严重损害目标检测等下游任务的性能' }
      ],
    },
    // Chapter 2: 输入表示
    {
      kind: 'chapter',
      id: 'chap-2',
      title: '输入表示：多标签退化描述',
      badge: 'inf',
      badgeLabel: '基础',
      bridge: '为了处理组合退化，我们需要一种方式来表示图像中存在哪些退化因子。MDUR数据集定义了8种原子退化类型。',
      analogy: {
        title: '加载照片到编辑器',
        text: '就像将照片加载到编辑软件中准备处理一样，我们需要将图像信息转换为可处理的格式。',
        componentId: 'multi-label-encoder'
      },
      modules: [
        {
          kind: 'module',
          id: '2.1',
          title: '多标签退化编码',
          desc: '将8种原子退化类型编码为多热向量。点击开关选择不同退化组合，观察编码结果如何表示复杂的退化配置。',
          componentId: 'multi-label-encoder'
        }
      ],
      insight: '每个退化配置表示为原子因子的组合，而不是一个不透明的类别标签。这使得模型能够泛化到未见过的组合。',
      formula: {
        lead: '退化配置用多热向量表示',
        unicode: 'm ∈ {0,1}⁸，其中 mⱼ=1 表示退化 dⱼ 存在',
        symbols: [
          { sym: 'm', desc: '多热退化掩码向量' },
          { sym: 'D', desc: '原子退化类型数量（D=8）' },
          { sym: 'dⱼ', desc: '第j种原子退化类型' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '原子因子', desc: '8种原子退化：雨、雪、雾、低光、过曝、模糊、噪声、伪影' },
        { icon: '🔧', title: '多热编码', desc: '多热向量可以表示任意退化组合' },
        { icon: '✨', title: '泛化能力', desc: '原子因子表示使模型能泛化到未见的组合' }
      ],
    },
    // Chapter 3: 关键洞察
    {
      kind: 'chapter',
      id: 'chap-3',
      title: '关键洞察：解耦感知与修复',
      badge: 'inf',
      badgeLabel: '基础',
      bridge: '现有统一修复方法的核心问题在于：它们将退化感知和图像修复耦合在一起，使用同一个隐式表示来完成两个任务。',
      analogy: {
        title: '诊断与治疗分离',
        text: '就像医生先诊断病因再进行治疗一样，我们先识别退化类型再进行修复。这种分离使两个任务都能更好地完成。',
        componentId: 'decoupling-demo'
      },
      modules: [
        {
          kind: 'module',
          id: '3.1',
          title: '解耦演示器',
          desc: '对比隐式表示（左）和显式解耦（右）的效果。隐式表示将多种退化压缩为模糊的单一条件，而显式解耦提供清晰的每因子描述。',
          componentId: 'decoupling-demo'
        }
      ],
      insight: 'DAME-Net的核心设计是将退化感知（FDPM）与图像修复（CDMM）显式解耦，用可解释的因子级描述替代纠缠的隐式条件。',
      formula: {
        lead: '解耦框架的数学表达',
        unicode: '(m̂, p) = P(x)，ŷ = R(x; m̂, p)',
        symbols: [
          { sym: 'P', desc: '退化感知模块（FDPM）' },
          { sym: 'R', desc: '修复模块（CDMM）' },
          { sym: 'm̂', desc: '预测的退化掩码' },
          { sym: 'p', desc: '语义嵌入' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '问题根源', desc: '隐式表示将多种退化压缩为单一条件，导致因子间干扰' },
        { icon: '🔧', title: '解耦设计', desc: '显式分离退化感知和图像修复两个阶段' },
        { icon: '✨', title: '可解释性', desc: '提供可解释的因子级退化描述' }
      ],
    },
    // Chapter 4: FDPM
    {
      kind: 'chapter',
      id: 'chap-4',
      title: 'FDPM：因子级退化感知',
      badge: 'both',
      badgeLabel: '基础+训练',
      bridge: 'Factor-wise Degradation Perception Module (FDPM) 是DAME-Net的退化感知组件，基于CLIP视觉-语言模型构建。',
      analogy: {
        title: '使用检测工具',
        text: '就像使用多种检测工具识别照片中的不同问题一样，FDPM同时检测所有退化类型。',
        componentId: 'fdpm-detector'
      },
      modules: [
        {
          kind: 'module',
          id: '4.1',
          title: '标签相似度软对齐',
          desc: '常规对比对齐把整个组合当成一个独立类别，只让它对齐一个 prompt；FDPM 改用标签向量之间的余弦相似度 S（式 4）当软目标，组合因此保留与成分因子的重叠。选一组因子，看各个任务提示拿到的权重。',
          figure: fig('sgdp_semantic.png'),
          componentId: 'fdpm-detector'
        }
      ],
      insight: 'FDPM在原子因子级别预测退化，使用CLIP共享嵌入空间捕获语义关系，标签相似性引导的软对齐保留组合结构。',
      formula: {
        lead: 'FDPM通过多标签预测头输出退化logits，并用标签相似度做软对齐',
        unicode:
          'z = h(fᵢ) ∈ ℝ⁹（Ĉ = D + 1 = 9），其中 fᵢ = Eᵥ(x)（d = 512）<br>' +
          'Sᵢⱼ = tᵢ·tⱼ / (‖tᵢ‖‖tⱼ‖)（式 4）',
        symbols: [
          { sym: 'z', desc: '退化logits向量' },
          { sym: 'h', desc: '多标签预测头：MLP + LayerNorm，隐藏宽度 2d' },
          { sym: 'fᵢ', desc: 'CLIP图像嵌入（d = 512）' },
          { sym: 'Eᵥ', desc: 'CLIP ViT-B/32 视觉编码器' },
          { sym: 'Ĉ', desc: 'logits 维度 = D+1 = 9：D 位退化 + 1 个 clean 位。复原阶段丢弃 clean 位，只用剩下的 8 位作退化掩码' },
          { sym: 'tₖ', desc: '任务 k 的多热标签向量，Ĉ = 9 维 0/1（K = 22 个对齐任务：1 clean + 21 已见配置）' },
          { sym: 'Sᵢⱼ', desc: '两个任务标签向量的余弦相似度（式 4），衡量它们的因子重叠程度。论文用它代替 one-hot 目标：雨+雾 离 雨 和 雾 都比离 噪声 近' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '原子级预测', desc: 'FDPM在原子因子级别预测退化，而非配置级别' },
        { icon: '🔧', title: 'CLIP基础', desc: '使用CLIP共享嵌入空间捕获退化语义关系' },
        { icon: '✨', title: '软对齐', desc: '标签相似性引导的软对齐保留组合退化结构' }
      ],
    },
    // Chapter 5: CDMM
    {
      kind: 'chapter',
      id: 'chap-5',
      title: 'CDMM：条件解耦MoE模块',
      badge: 'both',
      badgeLabel: '基础+训练',
      bridge: 'Conditioned Decoupled MoE Module (CDMM) 是DAME-Net的修复组件，使用FDPM提供的退化线索引导选择性修复。',
      analogy: {
        title: '四条通路各管一段',
        text: '就像修一张有多种毛病的照片要分头处理——校光照的、补细节的、去噪的各管一摊，CDMM 也把修复拆成四条通路：条件编码、双域校正、解耦专家、低频基座。',
        componentId: 'cdmm-router'
      },
      modules: [
        {
          kind: 'module',
          id: '5.1',
          title: '退化 token 编码器',
          desc: 'CDMM 四个协同组件里的第一个：把 FDPM 给的 (m̂, p) 变成每个阶段的条件向量。点选退化因子，看 10 个 token 里哪些参与注意力、哪些被硬 key 掩码排除。',
          componentId: 'cdmm-router'
        }
      ],
      insight: 'CDMM 由四个协同组件组成：退化 token 编码器（严格 token 掩码，m̂ⱼ = 0 的 token 被硬排除）、空间-频率混合骨干（5 阶段，通道 24/48/96/48/24，每阶段一个 CDCB）、DC-MoE 前馈（3 全局 + 5 空间专家）、低频基座分支。',
      formula: {
        lead: '退化 token 编码器：把 (m̂, p) 编码成每个阶段的查询结果',
        unicode:
          'U = [u_j; u_p; u_g]（D 个退化 token + 语义 token + 全局 token，e = 256）<br>' +
          'Z = Attn(Q, U, U)，{gₛ}ₛ₌₁⁵ = Z 的第 s 行（S = 5，4 头交叉注意力）',
        symbols: [
          { sym: 'U', desc: '键值集合，形状 (D+2)×e：D 个可学习退化 token + 语义 token u_p + 全局 token u_g' },
          { sym: 'u_j', desc: '第 j 个可学习退化 token（j = 1…D），与第 j 种原子退化对应' },
          { sym: 'u_p', desc: '语义 token u_p = LN(W_p·p)' },
          { sym: 'u_g', desc: '全局 token u_g = LN(MLP_g([m̂, p]))' },
          { sym: 'Q', desc: '阶段查询 token 集合 {q_s}（S = 5 个阶段）' },
          { sym: 'Z', desc: '交叉注意力输出，形状 S×e；第 s 行就是第 s 阶段的条件向量 g_s' },
          { sym: 'gₛ', desc: '第s阶段的条件向量' },
          { sym: 'm̂', desc: '预测的退化掩码；m̂ⱼ = 0 的退化 token 会被硬 key 掩码排除，不参与注意力' },
          { sym: 'p', desc: '语义嵌入' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '四个协同组件', desc: '条件编码 + 双域骨干 + 解耦 MoE + 低频基座' },
        { icon: '🔧', title: '严格 token 掩码', desc: 'm̂ⱼ = 0 的退化 token 被硬 key 掩码排除，不是软降权（表 III：去掉掉 0.56 dB）' },
        { icon: '✨', title: '逐阶段条件', desc: '5 个阶段各自一个条件向量 gₛ，而不是全场共用一个' }
      ],
    },
    // Chapter 6: CDCB
    {
      kind: 'chapter',
      id: 'chap-6',
      title: 'CDCB：空间-频率混合处理',
      badge: 'inf',
      badgeLabel: '基础',
      bridge: 'Condition-Aware Dual-domain Correction Block (CDCB) 在频率域和空间域联合处理特征，因为不同退化在不同域有不同特征。',
      analogy: {
        title: '应用双重校正',
        text: '就像同时调整照片的锐度和色彩平衡一样，CDCB在频率和空间域同时处理。',
        componentId: 'cdcb-processor'
      },
      modules: [
        {
          kind: 'module',
          id: '6.1',
          title: 'CDCB处理器',
          desc: '频率分支处理频谱特征（模糊、噪声），空间分支处理局部结构（雨条纹）。调整频率-空间门控权重观察效果。',
          figure: fig('CDCB.png'),
          componentId: 'cdcb-processor'
        }
      ],
      insight: '频率分支处理模糊、噪声等频谱退化，空间分支处理雨条纹等结构退化，学习的门控权重平衡两者。',
      formula: {
        lead: 'CDCB使用频率分支和空间分支联合处理',
        unicode: 'X_out = w · X_freq + (1-w) · X_spatial',
        symbols: [
          { sym: 'w', desc: '学习的门控权重' },
          { sym: 'X_freq', desc: '频率分支输出' },
          { sym: 'X_spatial', desc: '空间分支输出' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '双域处理', desc: '不同退化在不同域有不同特征' },
        { icon: '🔧', title: '频率分支', desc: '处理模糊、噪声等频谱退化' },
        { icon: '✨', title: '空间分支', desc: '处理雨条纹等结构退化' }
      ],
    },
    // Chapter 7: 训练目标
    {
      kind: 'chapter',
      id: 'chap-7',
      title: '训练目标：多任务优化',
      badge: 'trn',
      badgeLabel: '训练',
      bridge: 'DAME-Net采用两阶段训练策略：先训练FDPM退化感知模块，再训练CDMM修复模块。',
      analogy: {
        title: '调整编辑参数',
        text: '就像摄影师调整编辑软件的各项参数以获得最佳效果一样，训练过程优化多个损失函数。',
        componentId: 'training-monitor'
      },
      modules: [
        {
          kind: 'module',
          id: '7.1',
          title: '训练监控器',
          desc: '展示两阶段训练过程和损失变化。步进查看训练阶段，观察损失如何收敛。',
          componentId: 'training-monitor'
        }
      ],
      insight: '两阶段训练：Stage I训练FDPM（CLIP视觉编码器+多标签头），Stage II冻结FDPM，训练CDMM修复网络。',
      formula: {
        lead: '两个阶段各有一条损失（式 7 / 式 16），不是合成的一条',
        unicode:
          'L_P = λ_align·L_align + λ_cls·L_cls（Stage I）<br>' +
          'L_R = ‖ŷ − y‖₁ + λ_f·L_freq + λ_p·L_base（Stage II）',
        symbols: [
          { sym: 'L_P', desc: '感知阶段损失：Stage I 用它训练 FDPM，收敛后冻结（式 7）' },
          { sym: 'L_R', desc: '修复阶段损失：Stage II 用它训练修复网络（式 16）' },
          { sym: 'L_align', desc: '标签相似性引导的跨模态软对齐损失（λ_align = 0.1）' },
          { sym: 'L_cls', desc: '多标签 BCE 分类损失（λ_cls = 0.9）' },
          { sym: 'L_freq', desc: '掩码 FFT 幅度损失（λ_f = 0.1）' },
          { sym: 'L_base', desc: '低频基座分支损失，监督目标是引导滤波平滑后的 y_base（λ_p = 0.1）' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '两阶段训练', desc: '先训练FDPM，再训练CDMM修复网络' },
        { icon: '🔧', title: '多损失协同', desc: '多个损失函数协同优化不同方面' },
        { icon: '✨', title: '掩码增强', desc: '掩码过载增强减少对完美掩码的依赖' }
      ],
    },
    // Chapter 8: 架构创新
    {
      kind: 'chapter',
      id: 'chap-8',
      title: '架构创新：解耦MoE设计',
      badge: 'trn',
      badgeLabel: '训练',
      bridge: 'DAME-Net的架构创新包括Decoupled MoE Feed-Forward (DC-MoE) 和Base-Residual Dual-Branch Reconstruction。',
      analogy: {
        title: '高级编辑工具',
        text: '就像专业编辑软件有高级工具面板一样，DC-MoE提供专门的专家网络处理不同类型的退化。',
        componentId: 'architecture-explorer'
      },
      modules: [
        {
          kind: 'module',
          id: '8.1',
          title: '架构浏览器',
          desc: '点击查看DAME-Net架构的各个组件，了解数据如何在网络中流动。',
          componentId: 'architecture-explorer'
        },
        {
          kind: 'module',
          id: '8.2',
          title: 'DC-MoE路由器',
          desc: '演示全局专家和空间专家的路由机制。切换退化类型观察哪些专家被激活。',
          figure: fig('DCMOE.png'),
          componentId: 'dcmoe-router'
        }
      ],
      insight: 'DC-MoE将专家分为全局（3个，处理雾、低光、过曝）和空间（5个，处理雨、雪、模糊、噪声、伪影）两组，通过掩码约束路由避免干扰。',
      formula: {
        lead: '掩码约束路由与专家聚合（式 13 / 式 14）',
        unicode:
          'm̂ᵍ = Renorm(g ⊙ m̂ᵍ)，m̂ˢ = Renorm(s ⊙ m̂ˢ)<br>' +
          'FFN_MoE(X) = B(X) + Σᵢ m̂ᵢᵍ·Eᵢᵍ(X) + Σⱼ m̂ⱼˢ·Rⱼ ⊙ Eⱼˢ(X)',
        symbols: [
          { sym: 'FFN_MoE', desc: '解耦 MoE 前馈块的输出（是这个前馈块，不是整个网络）' },
          { sym: 'B', desc: '基座分支 B(X)：即使没有任何专家被激活也提供非零容量' },
          { sym: 'm̂ᵢᵍ', desc: '第 i 个全局专家的路由权重：掩码 × 门控后重归一化' },
          { sym: 'm̂ⱼˢ', desc: '第 j 个空间专家的路由权重：掩码 × 门控后重归一化' },
          { sym: 'Eᵢᵍ', desc: '第 i 个全局专家（共 3 个：雾、低光、过曝）' },
          { sym: 'Eⱼˢ', desc: '第 j 个空间专家（共 5 个：雨、雪、模糊、噪声、伪影）' },
          { sym: 'Rⱼ', desc: '空间路由图：取值 [0,1] 的 H×W 图，与专家输出逐元素相乘（⊙）' },
          { sym: 'm̂ᵍ', desc: '全局退化掩码位（雾、低光、过曝）' },
          { sym: 'm̂ˢ', desc: '空间退化掩码位（雨、雪、模糊、噪声、伪影）' },
          { sym: 'X', desc: '输入特征图' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '全局专家', desc: '3个专家处理场景级退化（雾、低光、过曝）' },
        { icon: '🔧', title: '空间专家', desc: '5个专家处理局部退化（雨、雪、模糊、噪声、伪影）' },
        { icon: '✨', title: '双分支重建', desc: '低频基础分支 + 高频残差分支' }
      ],
    },
    // Chapter 9: 实用技巧
    {
      kind: 'chapter',
      id: 'chap-9',
      title: '实用技巧：数据增强与优化',
      badge: 'trn',
      badgeLabel: '训练',
      bridge: '为了提高模型的鲁棒性，DAME-Net采用了掩码过载增强等训练技巧。',
      analogy: {
        title: '处理特殊情况',
        text: '就像摄影师处理特殊光线条件一样，数据增强帮助模型处理边缘情况。',
        componentId: 'augmentation-demo'
      },
      modules: [
        {
          kind: 'module',
          id: '9.1',
          title: '增强演示器',
          desc: '演示掩码过载增强：以0.05概率随机激活全局退化位，减少对完美掩码的依赖。',
          componentId: 'augmentation-demo'
        }
      ],
      insight: '掩码过载增强通过随机激活退化位，迫使修复网络学会处理不完美的掩码预测，提高鲁棒性。',
      takeaways: [
        { icon: '🎯', title: '掩码增强', desc: '掩码过载增强减少对完美掩码的依赖' },
        { icon: '🔧', title: '随机激活', desc: '概率0.05随机激活全局退化位' },
        { icon: '✨', title: '鲁棒性', desc: '提高模型对掩码预测错误的鲁棒性' }
      ],
    },
    // Chapter 10: 结果与对比
    {
      kind: 'chapter',
      id: 'chap-10',
      title: '结果与对比：MDUR基准测试',
      badge: 'both',
      badgeLabel: '基础+训练',
      bridge: 'MDUR是首个大规模UAV组合图像修复基准，包含43种退化配置，从单一退化到四因子组合。',
      analogy: {
        title: '修复前后对比',
        text: '就像对比照片编辑前后的效果一样，我们在MDUR基准上比较各方法的性能。',
        componentId: 'result-comparison'
      },
      modules: [
        {
          kind: 'module',
          id: '10.1',
          title: '结果竞赛器',
          desc: '对比DAME-Net与基线方法（AirNet, DehazeFormer, Restormer, PromptIR, AdaIR）在已见（21 个任务）与未见（22 个任务，zero-shot）两组口径下的平均性能。',
          figure: fig('qualitative_analysis.jpg'),
          componentId: 'result-comparison'
        }
      ],
      insight: 'DAME-Net在两组口径的每一个分组上都是最高：已见平均 27.67 dB / 0.8602，未见平均 18.62 dB / 0.6271，高出最强基线 2.16 dB——未见配置上的领先幅度明显大于已见。',
      formula: {
        lead: '评估指标',
        unicode: 'PSNR = 10·log₁₀(MAX²/MSE)，SSIM在Y通道计算',
        symbols: [
          { sym: 'PSNR', desc: '峰值信噪比（dB），越高越好' },
          { sym: 'SSIM', desc: '结构相似性，越高越好' },
          { sym: 'MAX', desc: '像素最大值（255）' }
        ]
      },
      takeaways: [
        { icon: '🎯', title: '一致优势', desc: '论文表 I 的每个分组（已见/未见 × 单/双/三/四因子）上 DAME-Net 都是最高' },
        { icon: '🔧', title: '组合泛化', desc: '未见配置上的领先幅度更大：总体未见 18.62 dB，高出最强基线 2.16 dB' },
        { icon: '✨', title: '下游受益', desc: '修复后的图像提升了目标检测性能' }
      ],
    },
  ],
  bilibili: [
    {
      bvid: 'BV1xx411c7mD',
      title: '无人机图像修复技术详解',
      reason: '相关领域技术讲解'
    },
    {
      bvid: 'BV1GJ411x7h7',
      title: '图像修复深度学习方法',
      reason: '图像修复方法综述'
    },
    {
      bvid: 'BV1uT4y1P7CX',
      title: 'Mixture of Experts原理讲解',
      reason: 'MoE架构原理'
    },
    {
      bvid: 'BV1hS4y1N7VX',
      title: 'CLIP模型详解',
      reason: 'CLIP视觉语言模型'
    }
  ],
};
