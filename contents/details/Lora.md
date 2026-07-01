# 🚀 LLM 微调实战与跨尺度参数量表征探测

## 📌 项目定位
**模型微调实战** | **多尺寸模型对比** | **内部表征演化分析**

模型微调实验：基于 LLaMA-Factory 框架，对 Llama 2/3 与 Qwen 系列模型开展 LoRA 及全参数监督微调（SFT），覆盖逻辑推理（GSM8K）、指令遵循（CodeAlpaca）等多领域数据集，探究微调对模型能力的影响。

核心问题：LLM 在哪一层"真正理解"了一个概念？

研究思路
大语言模型（LLaMA、Gemma、Qwen 等）是由几十层 Transformer 堆叠而成的。这个项目的核心假设是：不同的概念（情感、逻辑推理、事实知识）在不同的层被编码，浅层可能只捕捉到表面语法，深层才形成语义理解。

具体做法
1. 把一个问题喂给 LLM，用 baukit.TraceDict hook 住每一层 post_attention_layernorm 的输出，拿到每层的 hidden state（最后一个 token 的向量）
2. 对每一层分别训练一个轻量级的 probe 分类器（Logistic Regression 或 Random Forest）
3. 用 Accuracy / F1 / AUC 衡量每层的分类能力
4. 画出"分类准确率 vs 层数"的曲线，找到准确率突然上升的那一层——那就是模型"学会"这个概念的深度


---

## 1️⃣ 工业级微调实验设计
针对逻辑、代码、情感等多维度任务，构建了完整的微调与评估流水线。

* **实验对象**：
    * **横向对比**：Llama2-7B-chat-hf vs. Llama3.1-8B-Instruct。
    * **尺度演化**：Qwen2.5 全系列（0.5B, 1.5B, 3B, 7B）。
* **数据集**：覆盖 StrategyQA（逻辑推理）、GSM8K（数学）、CodeAlpaca（代码）及 STSA（情感）。
* **工程实现**：采用 **LoRA/SFT** 方案，在 A100 显存约束下实现量化训练。


---

## 2️⃣ 核心实验观测：模型尺度与“倒 U 型”曲线

**层级表征与探针分析**：大语言模型的多层 Transformer 结构会在不同层级编码不同类型的概念（如情感、逻辑推理、事实知识），浅层多捕捉表面语法特征，深层才形成稳定语义理解。通过 baukit.TraceDict 捕获各层隐状态，训练线性 / 轻量级分类探针，以准确率、F1、AUC 等指标评估每层对目标概念的编码能力，绘制 “层数 - 性能” 曲线定位语义形成的关键深度。针对微调前后的模型，对比分析各层对语义概念的识别准确率，成功复现了从表面语法到深层语义理解的 “激活临界层” 现象。

对比不同尺寸模型的 Probing 曲线，观察到了一个显著的工程现象：

* **“倒 U 型”曲线效应**：在 0.5B、1.5B 等小参数模型上，准确率往往在中间层达到峰值，随后在最后几层出现明显下滑。
* **工程假设**：实验数据暗示，**小模型具备一定的“中间层推理能力”，但由于参数量受限，在最后几层向预测概率分布映射时出现了信息丢失或“表达瓶颈”**；相比之下，大参数模型（7B+）的曲线更为稳定。


![qwen](static/assets/img/lora/qwen.png)
**不同参数的qwen3模型准确率**

---

## 3️ 探针实验与层级对比 (Linear Probing)
* **实验方案**：对每一层提取的向量分别训练一个 线性分类探针 (Linear Probe)。
* **分析维度**：对比微调前后，模型在不同深度处对“逻辑推理”或“情感语义”的分类准确率
* **工程发现**：观察到微调显著改变了模型内部的“语义爆发点”，即微调后的模型在更浅的层级就展现出了极高的语义辨析准确率。

![comp](static/assets/img/lora/comp.png)
**微调前后探针对比实验**

![sft](static/assets/img/lora/StrategyQA_Llama-7b_32_non-noise_LR.png)
**llama2-7b-chat-hf在StrategyQA数据集进行SFT微调后的探针准确率**

![lora](static/assets/img/lora/StrategyQA_lora_llama2-7B_32_non-noise_LR.png)
**llama2-7b-chat-hf在StrategyQA数据集进行LoRA微调后的探针准确率**

![stsa-llama2](static/assets/img/lora/STSA_Llama-7b_32_non-noise_LR.png)
**llama2-7b-chat-hf在StrategyQA数据集进行LoRA微调后的探针准确率**

![stsa-qwen2.5](static/assets/img/lora/STSA_Qwen2.5-7B_32_non-noise_LR.png)
**qwen2.5-7B在STSA数据集进行LoRA微调后的探针准确率**


![train](static/assets/img/lora/train.png)
**llama-factory训练页面**
