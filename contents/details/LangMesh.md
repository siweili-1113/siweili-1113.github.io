# ACMMM2026 在投，具体名字隐藏

---

## 🚀 摘要 (Abstract)
现有文本生成三维方法的核心局限：基于扩散 / 神经辐射场（NeRF）的方法缺乏可编辑性，参数化方法依赖外部模型资产库。

本文提出了一个无需训练的、完全集成的多智能体框架，旨在通过自然语言驱动 Blender 进行分步式 3D 建模。本文将复杂的建模任务拆解为五个协同工作的智能体：**场景图生成器**（构建空间意图）、**代码编写器**（生成 bpy 脚本）、**代码检索器**（辅助 API 调用）、**代码验证器**（视觉反馈闭环）以及**记忆模块**（防止语义偏移）。

---

## 🛠️ 系统架构 (Methodology)

我们的方法通过模拟人类建模师的思维逻辑，构建了全集成的处理流水线。

![workflow](static/assets/img/langmesh/workflow.png)
**workflow**

### 核心组件：
1. **Scene Graph Generator**: 将自然语言解析为结构化图 G=(V,E,A)，编码物体节点、关系边、部件几何属性与建模序列；
2. **Blender Code Coder**: 基于场景图、检索到的 API 与完整生成历史，迭代生成可执行 bpy.ops 脚本；
3. **Code Retriever (RAG)**：采用 E5-Mistral 嵌入与余弦相似度检索，弥合自然语言与 Blender API 之间的语义鸿沟，每个建模步骤选取 top-k=3 相关 API 函数；
4. **VLM Code Verifier**: 利用LVLM，结合几何数据、六视角渲染图（方位角 + 俯仰角）与场景图约束的连通性检查，给出 1–5 分评分与结构化修改建议；
5. **Global Memory**: 记忆模块，保存用户初始描述、场景图、每一轮迭代得分、生成代码与修改反馈，保证分数单调提升，并在长序列生成中避免语义漂移。

---

## 🌟 核心亮点 (Teaser)


![高质量生成结果](static/assets/img/langmesh/good.png)
**高质量生成结果**

- **闭环验证 (Closed-Loop)**：利用 VLM (Vision-Language Model) 作为验证器，实现“生成-反馈-优化”的迭代逻辑。
- **多智能体协同**：通过五大智能体各司其职，解决长程建模中的结构坍塌问题。
- **Blender 深度集成**：直接生成并执行 Python 脚本，支持工业级建模流程。

---



## 📊 实验结果 (Results)

### 定性对比 (Qualitative Comparison)
我们的方法在语义一致性和几何结构完整性上显著优于现有的code generation建模方案。

![与其他code generation方法对比](static/assets/img/langmesh/comp.png)
**与其他code generation方法对比**
![与 LL3M、BlenderLLM 对比1](static/assets/img/langmesh/compare1.png)
**与 LL3M、BlenderLLM 对比1**
![与 LL3M、BlenderLLM 对比2](static/assets/img/langmesh/compare2.png)
**与 LL3M、BlenderLLM 对比2**
![与 LL3M、BlenderLLM 对比3](static/assets/img/langmesh/compare3.png)
**与 LL3M、BlenderLLM 对比3**
![code生成建模的布线优势（与3d方法对比）](static/assets/img/langmesh/bowl.png)
**code生成建模的布线优势（与3d方法对比）**
![code生成建模的布线优势](static/assets/img/langmesh/gun.png)
**code生成建模的布线优势**
![公园场景](static/assets/img/langmesh/park_scene.png)
**公园场景**
![厨房场景](static/assets/img/langmesh/kitchen_scene.png)
**厨房场景**
![教室场景](static/assets/img/langmesh/classroom_scene.png)
**教室场景**

### 迭代过程展示 (Iterative Refinement)
通过 Code Verifier 的介入，模型能够修正最初的几何错误。

融合视觉信号（基于 CLIP 的渲染图评估）与结构连通性信号（基于场景图边的包围盒邻近性检查）；消融实验证明，移除任一信号均会导致指标下降，同时移除则会造成视觉美感与人类偏好的超加性崩塌，体现两种反馈模式的强互补性。

五维度评估体系：
语义相似度（六视角 CLIPScore，CLIP-ViT/L-14）
结构正确性（满足场景图接触约束的比例，基于包围盒邻近性）
视觉美感（基于渲染图的 LAION-Aesthetics 预测器）
代码成功率（平均编译尝试次数的倒数）
人类偏好（由具备≥6 个月三维建模经验的标注者盲评，标注者间一致性≥85%）

![迭代过程展示1（蛋糕）](static/assets/img/langmesh/gc2.png)
**迭代过程展示1（蛋糕）**
![迭代过程展示2（衣帽架）](static/assets/img/langmesh/gc1.png)
**迭代过程展示2（衣帽架）**
---

### 消融实验

1. 通过全 Claude-4、全 GPT-5.3 同质管线消融实验验证：性能提升来源于多智能体架构而非单一强模型，混合 GPT-5.3 + Claude-4 配置稳定优于两种单一模型方案。
2. 对 BC 检索器的 top-k 超参数（k=1,2,3,4,5）进行敏感性分析，确定 k=3 为最优值：k=1 对复杂几何操作多样性不足，k=5 则引入语义冗余，导致比例失真与几何不稳定。
3. 在 500 个 BlenderGenBench 样本上完成模块级消融实验：场景图生成器与 BC 检索器在结构正确性、视觉美感维度上各自独立贡献，但同时移除会导致人类偏好出现显著协同崩塌 —— 物体级 HP 从 40% 降至 14%，场景级从 39% 降至 8%。
