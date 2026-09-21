---
title: DeepSeek Architecture Notes
tags: [ai, deepseek, mla, moe]
---
# DeepSeek Architecture Notes
DeepSeek-V3 and R1 utilize Multi-Head Latent Attention (MLA) and Mixture of Experts (MoE).
MLA compresses the Key-Value (KV) cache into low-dimensional latent vectors, drastically reducing inference memory footprint while preserving expressive power.
DeepSeek-R1 demonstrates that reasoning behaviors can emerge through pure reinforcement learning without extensive supervised fine-tuning.
