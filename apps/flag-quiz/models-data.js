(function (root) {
  const MODELS = [
  {
    "code": "inclusionai/ling-2.6-flash",
    "name": "Ling-2.6-flash",
    "provider": "inclusionai",
    "inputPerM": 0.01,
    "outputPerM": 0.03,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "ibm-granite/granite-4.0-h-micro",
    "name": "Granite 4.0 Micro",
    "provider": "ibm-granite",
    "inputPerM": 0.017,
    "outputPerM": 0.112,
    "context": 131000,
    "tier": 3
  },
  {
    "code": "mistralai/mistral-nemo",
    "name": "Mistral Nemo",
    "provider": "mistralai",
    "inputPerM": 0.019,
    "outputPerM": 0.03,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "nex-agi/nex-n2-mini",
    "name": "Nex-N2-Mini",
    "provider": "nex-agi",
    "inputPerM": 0.025,
    "outputPerM": 0.1,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "meta-llama/llama-3.2-1b-instruct",
    "name": "Llama 3.2 1B Instruct",
    "provider": "meta-llama",
    "inputPerM": 0.027,
    "outputPerM": 0.201,
    "context": 60000,
    "tier": 2
  },
  {
    "code": "openai/gpt-oss-20b",
    "name": "gpt-oss-20b",
    "provider": "openai",
    "inputPerM": 0.03,
    "outputPerM": 0.13,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.7-flash",
    "name": "Qwen3.7 Flash",
    "provider": "qwen",
    "inputPerM": 0.03,
    "outputPerM": 0.13,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "amazon/nova-micro-v1",
    "name": "Nova Micro 1.0",
    "provider": "amazon",
    "inputPerM": 0.035,
    "outputPerM": 0.14,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-oss-120b",
    "name": "gpt-oss-120b",
    "provider": "openai",
    "inputPerM": 0.037,
    "outputPerM": 0.17,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "cohere/command-r7b-12-2024",
    "name": "Command R7B (12-2024)",
    "provider": "cohere",
    "inputPerM": 0.0375,
    "outputPerM": 0.15,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "sao10k/l3-lunaris-8b",
    "name": "Llama 3 8B Lunaris",
    "provider": "sao10k",
    "inputPerM": 0.04,
    "outputPerM": 0.05,
    "context": 8192,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-30b-a3b-instruct-2507",
    "name": "Qwen3 30B A3B Instruct 2507",
    "provider": "qwen",
    "inputPerM": 0.0482,
    "outputPerM": 0.1931,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "google/gemma-3-12b-it",
    "name": "Gemma 3 12B",
    "provider": "google",
    "inputPerM": 0.05,
    "outputPerM": 0.15,
    "context": 131072,
    "tier": 1
  },
  {
    "code": "google/gemma-3-4b-it",
    "name": "Gemma 3 4B",
    "provider": "google",
    "inputPerM": 0.05,
    "outputPerM": 0.1,
    "context": 131072,
    "tier": 1
  },
  {
    "code": "ibm-granite/granite-4.1-8b",
    "name": "Granite 4.1 8B",
    "provider": "ibm-granite",
    "inputPerM": 0.05,
    "outputPerM": 0.1,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "meta-llama/llama-3.1-8b-instruct",
    "name": "Llama 3.1 8B Instruct",
    "provider": "meta-llama",
    "inputPerM": 0.05,
    "outputPerM": 0.08,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "meta-llama/llama-3.2-3b-instruct",
    "name": "Llama 3.2 3B Instruct",
    "provider": "meta-llama",
    "inputPerM": 0.05,
    "outputPerM": 0.33,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-small-24b-instruct-2501",
    "name": "Mistral Small 3",
    "provider": "mistralai",
    "inputPerM": 0.05,
    "outputPerM": 0.08,
    "context": 32768,
    "tier": 1
  },
  {
    "code": "nvidia/nemotron-3-nano-30b-a3b",
    "name": "Nemotron 3 Nano 30B A3B",
    "provider": "nvidia",
    "inputPerM": 0.05,
    "outputPerM": 0.2,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "openai/gpt-5-nano",
    "name": "GPT-5 Nano",
    "provider": "openai",
    "inputPerM": 0.05,
    "outputPerM": 0.4,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "amazon/nova-lite-v1",
    "name": "Nova Lite 1.0",
    "provider": "amazon",
    "inputPerM": 0.06,
    "outputPerM": 0.24,
    "context": 300000,
    "tier": 1
  },
  {
    "code": "google/gemma-3n-e4b-it",
    "name": "Gemma 3n 4B",
    "provider": "google",
    "inputPerM": 0.06,
    "outputPerM": 0.12,
    "context": 32768,
    "tier": 1
  },
  {
    "code": "poolside/laguna-xs-2.1",
    "name": "Laguna XS 2.1",
    "provider": "poolside",
    "inputPerM": 0.06,
    "outputPerM": 0.12,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.7-flash",
    "name": "GLM 4.7 Flash",
    "provider": "z-ai",
    "inputPerM": 0.06,
    "outputPerM": 0.4,
    "context": 202752,
    "tier": 3
  },
  {
    "code": "tencent/hy3-preview",
    "name": "Hy3 preview",
    "provider": "tencent",
    "inputPerM": 0.063,
    "outputPerM": 0.21,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "qwen/qwen3.5-flash-02-23",
    "name": "Qwen3.5-Flash",
    "provider": "qwen",
    "inputPerM": 0.065,
    "outputPerM": 0.26,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "google/gemma-4-26b-a4b-it",
    "name": "Gemma 4 26B A4B ",
    "provider": "google",
    "inputPerM": 0.07,
    "outputPerM": 0.34,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "microsoft/phi-4",
    "name": "Phi 4",
    "provider": "microsoft",
    "inputPerM": 0.07,
    "outputPerM": 0.14,
    "context": 16384,
    "tier": 1
  },
  {
    "code": "qwen/qwen3-coder-30b-a3b-instruct",
    "name": "Qwen3 Coder 30B A3B Instruct",
    "provider": "qwen",
    "inputPerM": 0.07,
    "outputPerM": 0.27,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "bytedance-seed/seed-1.6-flash",
    "name": "Seed 1.6 Flash",
    "provider": "bytedance-seed",
    "inputPerM": 0.075,
    "outputPerM": 0.3,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "inclusionai/ling-2.6-1t",
    "name": "Ling-2.6-1T",
    "provider": "inclusionai",
    "inputPerM": 0.075,
    "outputPerM": 0.625,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "inclusionai/ring-2.6-1t",
    "name": "Ring-2.6-1T",
    "provider": "inclusionai",
    "inputPerM": 0.075,
    "outputPerM": 0.625,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "openai/gpt-oss-safeguard-20b",
    "name": "gpt-oss-safeguard-20b",
    "provider": "openai",
    "inputPerM": 0.075,
    "outputPerM": 0.3,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "google/gemma-3-27b-it",
    "name": "Gemma 3 27B",
    "provider": "google",
    "inputPerM": 0.08,
    "outputPerM": 0.45,
    "context": 262144,
    "tier": 1
  },
  {
    "code": "gryphe/mythomax-l2-13b",
    "name": "MythoMax 13B",
    "provider": "gryphe",
    "inputPerM": 0.08,
    "outputPerM": 0.11,
    "context": 8192,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-32b",
    "name": "Qwen3 32B",
    "provider": "qwen",
    "inputPerM": 0.08,
    "outputPerM": 0.28,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "nvidia/nemotron-3-super-120b-a12b",
    "name": "Nemotron 3 Super",
    "provider": "nvidia",
    "inputPerM": 0.085,
    "outputPerM": 0.4,
    "context": 1000000,
    "tier": 3
  },
  {
    "code": "deepseek/deepseek-v4-flash-0731",
    "name": "DeepSeek V4 Flash 0731",
    "provider": "deepseek",
    "inputPerM": 0.09,
    "outputPerM": 0.18,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "poolside/laguna-s-2.1",
    "name": "Laguna S 2.1",
    "provider": "poolside",
    "inputPerM": 0.09,
    "outputPerM": 0.18,
    "context": 1048576,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-next-80b-a3b-instruct",
    "name": "Qwen3 Next 80B A3B Instruct",
    "provider": "qwen",
    "inputPerM": 0.09,
    "outputPerM": 1.1,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-small-3.2-24b-instruct",
    "name": "Mistral Small 3.2 24B",
    "provider": "mistralai",
    "inputPerM": 0.0938,
    "outputPerM": 0.25,
    "context": 256000,
    "tier": 1
  },
  {
    "code": "bytedance-seed/seed-2.0-mini",
    "name": "Seed-2.0-Mini",
    "provider": "bytedance-seed",
    "inputPerM": 0.1,
    "outputPerM": 0.4,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "bytedance/ui-tars-1.5-7b",
    "name": "UI-TARS 7B ",
    "provider": "bytedance",
    "inputPerM": 0.1,
    "outputPerM": 0.2,
    "context": 128000,
    "tier": 3
  },
  {
    "code": "google/gemini-2.5-flash-lite",
    "name": "Gemini 2.5 Flash Lite",
    "provider": "google",
    "inputPerM": 0.1,
    "outputPerM": 0.4,
    "context": 1048576,
    "tier": 1
  },
  {
    "code": "google/gemma-4-31b-it",
    "name": "Gemma 4 31B",
    "provider": "google",
    "inputPerM": 0.1,
    "outputPerM": 0.34,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "meta-llama/llama-3.3-70b-instruct",
    "name": "Llama 3.3 70B Instruct",
    "provider": "meta-llama",
    "inputPerM": 0.1,
    "outputPerM": 0.32,
    "context": 131072,
    "tier": 1
  },
  {
    "code": "meta-llama/llama-4-scout",
    "name": "Llama 4 Scout",
    "provider": "meta-llama",
    "inputPerM": 0.1,
    "outputPerM": 0.3,
    "context": 1310720,
    "tier": 1
  },
  {
    "code": "mistralai/ministral-3b-2512",
    "name": "Ministral 3 3B 2512",
    "provider": "mistralai",
    "inputPerM": 0.1,
    "outputPerM": 0.1,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "mistralai/voxtral-small-24b-2507",
    "name": "Voxtral Small 24B 2507",
    "provider": "mistralai",
    "inputPerM": 0.1,
    "outputPerM": 0.3,
    "context": 32000,
    "tier": 2
  },
  {
    "code": "openai/gpt-4.1-nano",
    "name": "GPT-4.1 Nano",
    "provider": "openai",
    "inputPerM": 0.1,
    "outputPerM": 0.4,
    "context": 1047576,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.6-luna",
    "name": "GPT-5.6 Luna",
    "provider": "openai",
    "inputPerM": 0.1,
    "outputPerM": 0.6,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.6-luna-pro",
    "name": "GPT-5.6 Luna Pro",
    "provider": "openai",
    "inputPerM": 0.1,
    "outputPerM": 0.6,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "qwen/qwen-2.5-7b-instruct",
    "name": "Qwen2.5 7B Instruct",
    "provider": "qwen",
    "inputPerM": 0.1,
    "outputPerM": 0.2,
    "context": 32768,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.5-9b",
    "name": "Qwen3.5-9B",
    "provider": "qwen",
    "inputPerM": 0.1,
    "outputPerM": 0.15,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "rekaai/reka-edge",
    "name": "Reka Edge",
    "provider": "rekaai",
    "inputPerM": 0.1,
    "outputPerM": 0.1,
    "context": 16384,
    "tier": 3
  },
  {
    "code": "rekaai/reka-flash-3",
    "name": "Reka Flash 3",
    "provider": "rekaai",
    "inputPerM": 0.1,
    "outputPerM": 0.2,
    "context": 65536,
    "tier": 3
  },
  {
    "code": "stepfun/step-3.5-flash",
    "name": "Step 3.5 Flash",
    "provider": "stepfun",
    "inputPerM": 0.1,
    "outputPerM": 0.3,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-vl-32b-instruct",
    "name": "Qwen3 VL 32B Instruct",
    "provider": "qwen",
    "inputPerM": 0.104,
    "outputPerM": 0.416,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-8b",
    "name": "Qwen3 8B",
    "provider": "qwen",
    "inputPerM": 0.117,
    "outputPerM": 0.455,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-vl-8b-instruct",
    "name": "Qwen3 VL 8B Instruct",
    "provider": "qwen",
    "inputPerM": 0.117,
    "outputPerM": 0.455,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-30b-a3b",
    "name": "Qwen3 30B A3B",
    "provider": "qwen",
    "inputPerM": 0.12,
    "outputPerM": 0.5,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-coder-next",
    "name": "Qwen3 Coder Next",
    "provider": "qwen",
    "inputPerM": 0.12,
    "outputPerM": 0.8,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "nousresearch/hermes-4-70b",
    "name": "Hermes 4 70B",
    "provider": "nousresearch",
    "inputPerM": 0.13,
    "outputPerM": 0.4,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.5-air",
    "name": "GLM 4.5 Air",
    "provider": "z-ai",
    "inputPerM": 0.13,
    "outputPerM": 0.85,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "tencent/hy3",
    "name": "Hy3",
    "provider": "tencent",
    "inputPerM": 0.132,
    "outputPerM": 0.528,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "deepseek/deepseek-v4-flash",
    "name": "DeepSeek V4 Flash 0423",
    "provider": "deepseek",
    "inputPerM": 0.14,
    "outputPerM": 0.28,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.5-35b-a3b",
    "name": "Qwen3.5-35B-A3B",
    "provider": "qwen",
    "inputPerM": 0.14,
    "outputPerM": 1,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.6-35b-a3b",
    "name": "Qwen3.6 35B A3B",
    "provider": "qwen",
    "inputPerM": 0.14,
    "outputPerM": 1,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "tencent/hunyuan-a13b-instruct",
    "name": "Hunyuan A13B Instruct",
    "provider": "tencent",
    "inputPerM": 0.14,
    "outputPerM": 0.57,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "xiaomi/mimo-v2.5",
    "name": "MiMo-V2.5",
    "provider": "xiaomi",
    "inputPerM": 0.14,
    "outputPerM": 0.28,
    "context": 1050000,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-235b-a22b-2507",
    "name": "Qwen3 235B A22B Instruct 2507",
    "provider": "qwen",
    "inputPerM": 0.1495,
    "outputPerM": 0.598,
    "context": 262144,
    "tier": 1
  },
  {
    "code": "allenai/olmo-3-32b-think",
    "name": "Olmo 3 32B Think",
    "provider": "allenai",
    "inputPerM": 0.15,
    "outputPerM": 0.5,
    "context": 65536,
    "tier": 3
  },
  {
    "code": "cohere/command-r-08-2024",
    "name": "Command R (08-2024)",
    "provider": "cohere",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "kwaipilot/kat-coder-air-v2.5",
    "name": "KAT-Coder-Air V2.5",
    "provider": "kwaipilot",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 256000,
    "tier": 3
  },
  {
    "code": "mistralai/ministral-8b-2512",
    "name": "Ministral 3 8B 2512",
    "provider": "mistralai",
    "inputPerM": 0.15,
    "outputPerM": 0.15,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-small-2603",
    "name": "Mistral Small 4",
    "provider": "mistralai",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 262144,
    "tier": 1
  },
  {
    "code": "openai/gpt-4o-mini",
    "name": "GPT-4o-mini",
    "provider": "openai",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-4o-mini-2024-07-18",
    "name": "GPT-4o-mini (2024-07-18)",
    "provider": "openai",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "perceptron/perceptron-mk1",
    "name": "Perceptron Mk1",
    "provider": "perceptron",
    "inputPerM": 0.15,
    "outputPerM": 1.5,
    "context": 32768,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-next-80b-a3b-thinking",
    "name": "Qwen3 Next 80B A3B Thinking",
    "provider": "qwen",
    "inputPerM": 0.15,
    "outputPerM": 1.2,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-vl-30b-a3b-instruct",
    "name": "Qwen3 VL 30B A3B Instruct",
    "provider": "qwen",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "upstage/solar-pro-3",
    "name": "Solar Pro 3",
    "provider": "upstage",
    "inputPerM": 0.15,
    "outputPerM": 0.6,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "meta-llama/llama-guard-4-12b",
    "name": "Llama Guard 4 12B",
    "provider": "meta-llama",
    "inputPerM": 0.18,
    "outputPerM": 0.18,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-vl-8b-thinking",
    "name": "Qwen3 VL 8B Thinking",
    "provider": "qwen",
    "inputPerM": 0.18,
    "outputPerM": 2.1,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.6-flash",
    "name": "Qwen3.6 Flash",
    "provider": "qwen",
    "inputPerM": 0.1875,
    "outputPerM": 1.125,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-coder-flash",
    "name": "Qwen3 Coder Flash",
    "provider": "qwen",
    "inputPerM": 0.195,
    "outputPerM": 0.975,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.5-27b",
    "name": "Qwen3.5-27B",
    "provider": "qwen",
    "inputPerM": 0.195,
    "outputPerM": 1.56,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "cognitivecomputations/dolphin-mistral-24b-venice-edition",
    "name": "Uncensored",
    "provider": "cognitivecomputations",
    "inputPerM": 0.2,
    "outputPerM": 0.9,
    "context": 128000,
    "tier": 3
  },
  {
    "code": "meta-llama/llama-4-maverick",
    "name": "Llama 4 Maverick",
    "provider": "meta-llama",
    "inputPerM": 0.2,
    "outputPerM": 0.8,
    "context": 1048576,
    "tier": 1
  },
  {
    "code": "minimax/minimax-01",
    "name": "MiniMax-01",
    "provider": "minimax",
    "inputPerM": 0.2,
    "outputPerM": 1.1,
    "context": 1000192,
    "tier": 3
  },
  {
    "code": "mistralai/ministral-14b-2512",
    "name": "Ministral 3 14B 2512",
    "provider": "mistralai",
    "inputPerM": 0.2,
    "outputPerM": 0.2,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-saba",
    "name": "Saba",
    "provider": "mistralai",
    "inputPerM": 0.2,
    "outputPerM": 0.6,
    "context": 32768,
    "tier": 2
  },
  {
    "code": "openai/gpt-5.4-nano",
    "name": "GPT-5.4 Nano",
    "provider": "openai",
    "inputPerM": 0.2,
    "outputPerM": 1.25,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "qwen/qwen3-30b-a3b-thinking-2507",
    "name": "Qwen3 30B A3B Thinking 2507",
    "provider": "qwen",
    "inputPerM": 0.2,
    "outputPerM": 2.4,
    "context": 81920,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-vl-30b-a3b-thinking",
    "name": "Qwen3 VL 30B A3B Thinking",
    "provider": "qwen",
    "inputPerM": 0.2,
    "outputPerM": 2.4,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "stepfun/step-3.7-flash",
    "name": "Step 3.7 Flash",
    "provider": "stepfun",
    "inputPerM": 0.2,
    "outputPerM": 1.15,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-vl-235b-a22b-instruct",
    "name": "Qwen3 VL 235B A22B Instruct",
    "provider": "qwen",
    "inputPerM": 0.21,
    "outputPerM": 1.9,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "arcee-ai/trinity-large-thinking",
    "name": "Trinity Large Thinking",
    "provider": "arcee-ai",
    "inputPerM": 0.22,
    "outputPerM": 0.85,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "minimax/minimax-m2.5",
    "name": "MiniMax M2.5",
    "provider": "minimax",
    "inputPerM": 0.22,
    "outputPerM": 0.9,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-14b",
    "name": "Qwen3 14B",
    "provider": "qwen",
    "inputPerM": 0.2275,
    "outputPerM": 0.91,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-235b-a22b-thinking-2507",
    "name": "Qwen3 235B A22B Thinking 2507",
    "provider": "qwen",
    "inputPerM": 0.23,
    "outputPerM": 2.3,
    "context": 262144,
    "tier": 1
  },
  {
    "code": "anthropic/claude-3-haiku",
    "name": "Claude 3 Haiku",
    "provider": "anthropic",
    "inputPerM": 0.25,
    "outputPerM": 1.25,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "bytedance-seed/seed-1.6",
    "name": "Seed 1.6",
    "provider": "bytedance-seed",
    "inputPerM": 0.25,
    "outputPerM": 2,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "bytedance-seed/seed-2.0-lite",
    "name": "Seed-2.0-Lite",
    "provider": "bytedance-seed",
    "inputPerM": 0.25,
    "outputPerM": 2,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "deepseek/deepseek-chat-v3.1",
    "name": "DeepSeek V3.1",
    "provider": "deepseek",
    "inputPerM": 0.25,
    "outputPerM": 0.95,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "google/gemini-3.1-flash-lite",
    "name": "Gemini 3.1 Flash Lite",
    "provider": "google",
    "inputPerM": 0.25,
    "outputPerM": 1.5,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "google/gemini-3.1-flash-lite-image",
    "name": "Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)",
    "provider": "google",
    "inputPerM": 0.25,
    "outputPerM": 1.5,
    "context": 65536,
    "tier": 2
  },
  {
    "code": "google/gemini-3.1-flash-lite-preview",
    "name": "Gemini 3.1 Flash Lite Preview",
    "provider": "google",
    "inputPerM": 0.25,
    "outputPerM": 1.5,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "inception/mercury-2",
    "name": "Mercury 2",
    "provider": "inception",
    "inputPerM": 0.25,
    "outputPerM": 0.75,
    "context": 128000,
    "tier": 3
  },
  {
    "code": "nex-agi/nex-n2-pro",
    "name": "Nex-N2-Pro",
    "provider": "nex-agi",
    "inputPerM": 0.25,
    "outputPerM": 1,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "openai/gpt-5-mini",
    "name": "GPT-5 Mini",
    "provider": "openai",
    "inputPerM": 0.25,
    "outputPerM": 2,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.1-codex-mini",
    "name": "GPT-5.1-Codex-Mini",
    "provider": "openai",
    "inputPerM": 0.25,
    "outputPerM": 2,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "qwen/qwen2.5-vl-72b-instruct",
    "name": "Qwen2.5 VL 72B Instruct",
    "provider": "qwen",
    "inputPerM": 0.25,
    "outputPerM": 0.75,
    "context": 128000,
    "tier": 2
  },
  {
    "code": "thedrummer/rocinante-12b",
    "name": "Rocinante 12B",
    "provider": "thedrummer",
    "inputPerM": 0.25,
    "outputPerM": 0.5,
    "context": 65536,
    "tier": 3
  },
  {
    "code": "minimax/minimax-m2",
    "name": "MiniMax M2",
    "provider": "minimax",
    "inputPerM": 0.255,
    "outputPerM": 1.02,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "deepseek/deepseek-chat",
    "name": "DeepSeek V3",
    "provider": "deepseek",
    "inputPerM": 0.2574,
    "outputPerM": 1.0287,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "qwen/qwen-plus",
    "name": "Qwen-Plus",
    "provider": "qwen",
    "inputPerM": 0.26,
    "outputPerM": 0.78,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "qwen/qwen-plus-2025-07-28",
    "name": "Qwen Plus 0728",
    "provider": "qwen",
    "inputPerM": 0.26,
    "outputPerM": 0.78,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.5-122b-a10b",
    "name": "Qwen3.5-122B-A10B",
    "provider": "qwen",
    "inputPerM": 0.26,
    "outputPerM": 2.08,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.5-plus-02-15",
    "name": "Qwen3.5 Plus 2026-02-15",
    "provider": "qwen",
    "inputPerM": 0.26,
    "outputPerM": 1.56,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "deepseek/deepseek-v3.2",
    "name": "DeepSeek V3.2",
    "provider": "deepseek",
    "inputPerM": 0.269,
    "outputPerM": 0.4,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "deepseek/deepseek-chat-v3-0324",
    "name": "DeepSeek V3 0324",
    "provider": "deepseek",
    "inputPerM": 0.27,
    "outputPerM": 1.12,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "deepseek/deepseek-v3.1-terminus",
    "name": "DeepSeek V3.1 Terminus",
    "provider": "deepseek",
    "inputPerM": 0.27,
    "outputPerM": 1,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "deepseek/deepseek-v3.2-exp",
    "name": "DeepSeek V3.2 Exp",
    "provider": "deepseek",
    "inputPerM": 0.27,
    "outputPerM": 0.41,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "minimax/minimax-m2.7",
    "name": "MiniMax M2.7",
    "provider": "minimax",
    "inputPerM": 0.27,
    "outputPerM": 1.08,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "qwen/qwen3.6-27b",
    "name": "Qwen3.6 27B",
    "provider": "qwen",
    "inputPerM": 0.289,
    "outputPerM": 2.4,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "amazon/nova-2-lite-v1",
    "name": "Nova 2 Lite",
    "provider": "amazon",
    "inputPerM": 0.3,
    "outputPerM": 2.5,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "google/gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "google",
    "inputPerM": 0.3,
    "outputPerM": 2.5,
    "context": 1048576,
    "tier": 1
  },
  {
    "code": "google/gemini-2.5-flash-image",
    "name": "Nano Banana (Gemini 2.5 Flash Image)",
    "provider": "google",
    "inputPerM": 0.3,
    "outputPerM": 2.5,
    "context": 32768,
    "tier": 1
  },
  {
    "code": "google/gemini-3.5-flash-lite",
    "name": "Gemini 3.5 Flash Lite",
    "provider": "google",
    "inputPerM": 0.3,
    "outputPerM": 2.5,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "kwaipilot/kat-coder-pro-v2",
    "name": "KAT-Coder-Pro V2",
    "provider": "kwaipilot",
    "inputPerM": 0.3,
    "outputPerM": 1.2,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "meituan/longcat-2.0",
    "name": "LongCat 2.0",
    "provider": "meituan",
    "inputPerM": 0.3,
    "outputPerM": 1.2,
    "context": 1048756,
    "tier": 3
  },
  {
    "code": "minimax/minimax-m2-her",
    "name": "MiniMax M2-her",
    "provider": "minimax",
    "inputPerM": 0.3,
    "outputPerM": 1.2,
    "context": 65536,
    "tier": 3
  },
  {
    "code": "minimax/minimax-m2.1",
    "name": "MiniMax M2.1",
    "provider": "minimax",
    "inputPerM": 0.3,
    "outputPerM": 1.2,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "minimax/minimax-m3",
    "name": "MiniMax M3",
    "provider": "minimax",
    "inputPerM": 0.3,
    "outputPerM": 1.2,
    "context": 1048576,
    "tier": 3
  },
  {
    "code": "mistralai/codestral-2508",
    "name": "Codestral 2508",
    "provider": "mistralai",
    "inputPerM": 0.3,
    "outputPerM": 0.9,
    "context": 256000,
    "tier": 1
  },
  {
    "code": "qwen/qwen3-coder",
    "name": "Qwen3 Coder 480B A35B",
    "provider": "qwen",
    "inputPerM": 0.3,
    "outputPerM": 1,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.5-plus-20260420",
    "name": "Qwen3.5 Plus 2026-04-20",
    "provider": "qwen",
    "inputPerM": 0.3,
    "outputPerM": 1.8,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "thedrummer/cydonia-24b-v4.1",
    "name": "Cydonia 24B V4.1",
    "provider": "thedrummer",
    "inputPerM": 0.3,
    "outputPerM": 0.5,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.6v",
    "name": "GLM 4.6V",
    "provider": "z-ai",
    "inputPerM": 0.3,
    "outputPerM": 0.9,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "qwen/qwen3.7-plus",
    "name": "Qwen3.7 Plus",
    "provider": "qwen",
    "inputPerM": 0.32,
    "outputPerM": 1.28,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.6-plus",
    "name": "Qwen3.6 Plus",
    "provider": "qwen",
    "inputPerM": 0.325,
    "outputPerM": 1.95,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-small-3.1-24b-instruct",
    "name": "Mistral Small 3.1 24B",
    "provider": "mistralai",
    "inputPerM": 0.351,
    "outputPerM": 0.555,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "qwen/qwen-2.5-72b-instruct",
    "name": "Qwen2.5 72B Instruct",
    "provider": "qwen",
    "inputPerM": 0.36,
    "outputPerM": 0.4,
    "context": 32768,
    "tier": 1
  },
  {
    "code": "qwen/qwen3.5-397b-a17b",
    "name": "Qwen3.5 397B A17B",
    "provider": "qwen",
    "inputPerM": 0.39,
    "outputPerM": 2.34,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "meta-llama/llama-3.1-70b-instruct",
    "name": "Llama 3.1 70B Instruct",
    "provider": "meta-llama",
    "inputPerM": 0.4,
    "outputPerM": 0.4,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-medium-3",
    "name": "Mistral Medium 3",
    "provider": "mistralai",
    "inputPerM": 0.4,
    "outputPerM": 2,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-medium-3.1",
    "name": "Mistral Medium 3.1",
    "provider": "mistralai",
    "inputPerM": 0.4,
    "outputPerM": 2,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "openai/gpt-4.1-mini",
    "name": "GPT-4.1 Mini",
    "provider": "openai",
    "inputPerM": 0.4,
    "outputPerM": 1.6,
    "context": 1047576,
    "tier": 1
  },
  {
    "code": "qwen/qwen-plus-2025-07-28:thinking",
    "name": "Qwen Plus 0728 (thinking)",
    "provider": "qwen",
    "inputPerM": 0.4,
    "outputPerM": 1.2,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-vl-235b-a22b-thinking",
    "name": "Qwen3 VL 235B A22B Thinking",
    "provider": "qwen",
    "inputPerM": 0.4,
    "outputPerM": 4,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "thedrummer/unslopnemo-12b",
    "name": "UnslopNemo 12B",
    "provider": "thedrummer",
    "inputPerM": 0.4,
    "outputPerM": 0.4,
    "context": 1024000,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.7",
    "name": "GLM 4.7",
    "provider": "z-ai",
    "inputPerM": 0.4,
    "outputPerM": 1.75,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "baidu/ernie-4.5-vl-424b-a47b",
    "name": "ERNIE 4.5 VL 424B A47B ",
    "provider": "baidu",
    "inputPerM": 0.42,
    "outputPerM": 1.25,
    "context": 123000,
    "tier": 3
  },
  {
    "code": "deepseek/deepseek-v4-pro",
    "name": "DeepSeek V4 Pro",
    "provider": "deepseek",
    "inputPerM": 0.435,
    "outputPerM": 0.87,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "xiaomi/mimo-v2.5-pro",
    "name": "MiMo-V2.5-Pro",
    "provider": "xiaomi",
    "inputPerM": 0.435,
    "outputPerM": 0.87,
    "context": 1050000,
    "tier": 3
  },
  {
    "code": "undi95/remm-slerp-l2-13b",
    "name": "ReMM SLERP 13B",
    "provider": "undi95",
    "inputPerM": 0.45,
    "outputPerM": 0.65,
    "context": 6144,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-235b-a22b",
    "name": "Qwen3 235B A22B",
    "provider": "qwen",
    "inputPerM": 0.455,
    "outputPerM": 1.82,
    "context": 131072,
    "tier": 1
  },
  {
    "code": "deepseek/deepseek-r1-0528",
    "name": "R1 0528",
    "provider": "deepseek",
    "inputPerM": 0.5,
    "outputPerM": 2.15,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "google/gemini-3-flash-preview",
    "name": "Gemini 3 Flash Preview",
    "provider": "google",
    "inputPerM": 0.5,
    "outputPerM": 3,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "google/gemini-3.1-flash-image",
    "name": "Nano Banana 2 (Gemini 3.1 Flash Image)",
    "provider": "google",
    "inputPerM": 0.5,
    "outputPerM": 3,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "google/gemini-3.1-flash-image-preview",
    "name": "Nano Banana 2 (Gemini 3.1 Flash Image Preview)",
    "provider": "google",
    "inputPerM": 0.5,
    "outputPerM": 3,
    "context": 65536,
    "tier": 2
  },
  {
    "code": "mancer/weaver",
    "name": "Weaver (alpha)",
    "provider": "mancer",
    "inputPerM": 0.5,
    "outputPerM": 0.75,
    "context": 8000,
    "tier": 3
  },
  {
    "code": "mistralai/mistral-large-2512",
    "name": "Mistral Large 3 2512",
    "provider": "mistralai",
    "inputPerM": 0.5,
    "outputPerM": 1.5,
    "context": 262144,
    "tier": 1
  },
  {
    "code": "openai/gpt-3.5-turbo",
    "name": "GPT-3.5 Turbo",
    "provider": "openai",
    "inputPerM": 0.5,
    "outputPerM": 1.5,
    "context": 16385,
    "tier": 2
  },
  {
    "code": "thinkingmachines/inkling-small",
    "name": "Inkling Small",
    "provider": "thinkingmachines",
    "inputPerM": 0.5,
    "outputPerM": 1.2,
    "context": 524288,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.6",
    "name": "GLM 4.6",
    "provider": "z-ai",
    "inputPerM": 0.5,
    "outputPerM": 2,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "minimax/minimax-m1",
    "name": "MiniMax M1",
    "provider": "minimax",
    "inputPerM": 0.55,
    "outputPerM": 2.2,
    "context": 1000000,
    "tier": 3
  },
  {
    "code": "thedrummer/skyfall-36b-v2",
    "name": "Skyfall 36B V2",
    "provider": "thedrummer",
    "inputPerM": 0.55,
    "outputPerM": 0.8,
    "context": 32768,
    "tier": 3
  },
  {
    "code": "moonshotai/kimi-k2",
    "name": "Kimi K2 0711",
    "provider": "moonshotai",
    "inputPerM": 0.57,
    "outputPerM": 2.3,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "moonshotai/kimi-k2.5",
    "name": "Kimi K2.5",
    "provider": "moonshotai",
    "inputPerM": 0.57,
    "outputPerM": 2.85,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "moonshotai/kimi-k2.6",
    "name": "Kimi K2.6",
    "provider": "moonshotai",
    "inputPerM": 0.589,
    "outputPerM": 2.48,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "moonshotai/kimi-k2-0905",
    "name": "Kimi K2 0905",
    "provider": "moonshotai",
    "inputPerM": 0.6,
    "outputPerM": 2.5,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "moonshotai/kimi-k2-thinking",
    "name": "Kimi K2 Thinking",
    "provider": "moonshotai",
    "inputPerM": 0.6,
    "outputPerM": 2.5,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "nvidia/nemotron-3-ultra-550b-a55b",
    "name": "Nemotron 3 Ultra",
    "provider": "nvidia",
    "inputPerM": 0.6,
    "outputPerM": 3.6,
    "context": 512288,
    "tier": 3
  },
  {
    "code": "openai/gpt-audio-mini",
    "name": "GPT Audio Mini",
    "provider": "openai",
    "inputPerM": 0.6,
    "outputPerM": 2.4,
    "context": 128000,
    "tier": 2
  },
  {
    "code": "writer/palmyra-x5",
    "name": "Palmyra X5",
    "provider": "writer",
    "inputPerM": 0.6,
    "outputPerM": 6,
    "context": 1040000,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.5",
    "name": "GLM 4.5",
    "provider": "z-ai",
    "inputPerM": 0.6,
    "outputPerM": 2.2,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "z-ai/glm-4.5v",
    "name": "GLM 4.5V",
    "provider": "z-ai",
    "inputPerM": 0.6,
    "outputPerM": 1.8,
    "context": 65536,
    "tier": 3
  },
  {
    "code": "microsoft/wizardlm-2-8x22b",
    "name": "WizardLM-2 8x22B",
    "provider": "microsoft",
    "inputPerM": 0.62,
    "outputPerM": 0.62,
    "context": 65535,
    "tier": 3
  },
  {
    "code": "google/gemma-2-27b-it",
    "name": "Gemma 2 27B",
    "provider": "google",
    "inputPerM": 0.65,
    "outputPerM": 0.65,
    "context": 8192,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-coder-plus",
    "name": "Qwen3 Coder Plus",
    "provider": "qwen",
    "inputPerM": 0.65,
    "outputPerM": 3.25,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "sao10k/l3.3-euryale-70b",
    "name": "Llama 3.3 Euryale 70B",
    "provider": "sao10k",
    "inputPerM": 0.65,
    "outputPerM": 0.75,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "qwen/qwen-2.5-coder-32b-instruct",
    "name": "Qwen2.5 Coder 32B Instruct",
    "provider": "qwen",
    "inputPerM": 0.66,
    "outputPerM": 1,
    "context": 32768,
    "tier": 2
  },
  {
    "code": "aion-labs/aion-3.0-mini",
    "name": "Aion-3.0-Mini",
    "provider": "aion-labs",
    "inputPerM": 0.7,
    "outputPerM": 1.4,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "deepseek/deepseek-r1",
    "name": "R1",
    "provider": "deepseek",
    "inputPerM": 0.7,
    "outputPerM": 2.5,
    "context": 163840,
    "tier": 1
  },
  {
    "code": "moonshotai/kimi-k2.7-code",
    "name": "Kimi K2.7 Code",
    "provider": "moonshotai",
    "inputPerM": 0.7,
    "outputPerM": 3.5,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "nousresearch/hermes-3-llama-3.1-70b",
    "name": "Hermes 3 70B Instruct",
    "provider": "nousresearch",
    "inputPerM": 0.7,
    "outputPerM": 0.7,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "kwaipilot/kat-coder-pro-v2.5",
    "name": "KAT-Coder-Pro V2.5",
    "provider": "kwaipilot",
    "inputPerM": 0.74,
    "outputPerM": 2.96,
    "context": 256000,
    "tier": 3
  },
  {
    "code": "arcee-ai/virtuoso-large",
    "name": "Virtuoso Large",
    "provider": "arcee-ai",
    "inputPerM": 0.75,
    "outputPerM": 1.2,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "openai/gpt-5.4-mini",
    "name": "GPT-5.4 Mini",
    "provider": "openai",
    "inputPerM": 0.75,
    "outputPerM": 4.5,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "z-ai/glm-5.2",
    "name": "GLM 5.2",
    "provider": "z-ai",
    "inputPerM": 0.76,
    "outputPerM": 2.42,
    "context": 1048576,
    "tier": 3
  },
  {
    "code": "qwen/qwen3-max",
    "name": "Qwen3 Max",
    "provider": "qwen",
    "inputPerM": 0.78,
    "outputPerM": 3.9,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "qwen/qwen3-max-thinking",
    "name": "Qwen3 Max Thinking",
    "provider": "qwen",
    "inputPerM": 0.78,
    "outputPerM": 3.9,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "aion-labs/aion-2.0",
    "name": "Aion-2.0",
    "provider": "aion-labs",
    "inputPerM": 0.8,
    "outputPerM": 1.6,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "aion-labs/aion-rp-llama-3.1-8b",
    "name": "Aion-RP 1.0 (8B)",
    "provider": "aion-labs",
    "inputPerM": 0.8,
    "outputPerM": 1.6,
    "context": 32768,
    "tier": 3
  },
  {
    "code": "amazon/nova-pro-v1",
    "name": "Nova Pro 1.0",
    "provider": "amazon",
    "inputPerM": 0.8,
    "outputPerM": 3.2,
    "context": 300000,
    "tier": 1
  },
  {
    "code": "deepseek/deepseek-r1-distill-llama-70b",
    "name": "R1 Distill Llama 70B",
    "provider": "deepseek",
    "inputPerM": 0.8,
    "outputPerM": 0.8,
    "context": 8192,
    "tier": 1
  },
  {
    "code": "morph/morph-v3-fast",
    "name": "Morph V3 Fast",
    "provider": "morph",
    "inputPerM": 0.8,
    "outputPerM": 1.2,
    "context": 81920,
    "tier": 3
  },
  {
    "code": "relace/relace-apply-3",
    "name": "Relace Apply 3",
    "provider": "relace",
    "inputPerM": 0.85,
    "outputPerM": 1.25,
    "context": 256000,
    "tier": 3
  },
  {
    "code": "sao10k/l3.1-euryale-70b",
    "name": "Llama 3.1 Euryale 70B v2.2",
    "provider": "sao10k",
    "inputPerM": 0.85,
    "outputPerM": 0.85,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "morph/morph-v3-large",
    "name": "Morph V3 Large",
    "provider": "morph",
    "inputPerM": 0.9,
    "outputPerM": 1.9,
    "context": 262144,
    "tier": 3
  },
  {
    "code": "z-ai/glm-5",
    "name": "GLM 5",
    "provider": "z-ai",
    "inputPerM": 0.95,
    "outputPerM": 2.55,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "z-ai/glm-5.1",
    "name": "GLM 5.1",
    "provider": "z-ai",
    "inputPerM": 0.952,
    "outputPerM": 2.992,
    "context": 204800,
    "tier": 3
  },
  {
    "code": "anthropic/claude-haiku-4.5",
    "name": "Claude Haiku 4.5",
    "provider": "anthropic",
    "inputPerM": 1,
    "outputPerM": 5,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "nousresearch/hermes-3-llama-3.1-405b",
    "name": "Hermes 3 405B Instruct",
    "provider": "nousresearch",
    "inputPerM": 1,
    "outputPerM": 1,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "nousresearch/hermes-4-405b",
    "name": "Hermes 4 405B",
    "provider": "nousresearch",
    "inputPerM": 1,
    "outputPerM": 3,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "openai/gpt-3.5-turbo-0613",
    "name": "GPT-3.5 Turbo (older v0613)",
    "provider": "openai",
    "inputPerM": 1,
    "outputPerM": 2,
    "context": 4095,
    "tier": 2
  },
  {
    "code": "openai/gpt-5.6-terra",
    "name": "GPT-5.6 Terra",
    "provider": "openai",
    "inputPerM": 1,
    "outputPerM": 6,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.6-terra-pro",
    "name": "GPT-5.6 Terra Pro",
    "provider": "openai",
    "inputPerM": 1,
    "outputPerM": 6,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "perplexity/sonar",
    "name": "Sonar",
    "provider": "perplexity",
    "inputPerM": 1,
    "outputPerM": 1,
    "context": 127072,
    "tier": 1
  },
  {
    "code": "relace/relace-search",
    "name": "Relace Search",
    "provider": "relace",
    "inputPerM": 1,
    "outputPerM": 3,
    "context": 256000,
    "tier": 3
  },
  {
    "code": "thinkingmachines/inkling",
    "name": "Inkling",
    "provider": "thinkingmachines",
    "inputPerM": 1,
    "outputPerM": 4.05,
    "context": 1048576,
    "tier": 3
  },
  {
    "code": "x-ai/grok-build-0.1",
    "name": "Grok Build 0.1",
    "provider": "x-ai",
    "inputPerM": 1,
    "outputPerM": 2,
    "context": 256000,
    "tier": 2
  },
  {
    "code": "qwen/qwen3.6-max-preview",
    "name": "Qwen3.6 Max Preview",
    "provider": "qwen",
    "inputPerM": 1.027,
    "outputPerM": 6.162,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "openai/o3-mini",
    "name": "o3 Mini",
    "provider": "openai",
    "inputPerM": 1.1,
    "outputPerM": 4.4,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "openai/o3-mini-high",
    "name": "o3 Mini High",
    "provider": "openai",
    "inputPerM": 1.1,
    "outputPerM": 4.4,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "openai/o4-mini",
    "name": "o4 Mini",
    "provider": "openai",
    "inputPerM": 1.1,
    "outputPerM": 4.4,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "openai/o4-mini-high",
    "name": "o4 Mini High",
    "provider": "openai",
    "inputPerM": 1.1,
    "outputPerM": 4.4,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "z-ai/glm-5-turbo",
    "name": "GLM 5 Turbo",
    "provider": "z-ai",
    "inputPerM": 1.2,
    "outputPerM": 4,
    "context": 202752,
    "tier": 3
  },
  {
    "code": "z-ai/glm-5v-turbo",
    "name": "GLM 5V Turbo",
    "provider": "z-ai",
    "inputPerM": 1.2,
    "outputPerM": 4,
    "context": 202752,
    "tier": 3
  },
  {
    "code": "deepcogito/cogito-v2.1-671b",
    "name": "Cogito v2.1 671B",
    "provider": "deepcogito",
    "inputPerM": 1.25,
    "outputPerM": 1.25,
    "context": 128000,
    "tier": 3
  },
  {
    "code": "google/gemini-2.5-pro",
    "name": "Gemini 2.5 Pro",
    "provider": "google",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 1048576,
    "tier": 1
  },
  {
    "code": "google/gemini-2.5-pro-preview",
    "name": "Gemini 2.5 Pro Preview 06-05",
    "provider": "google",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 1048576,
    "tier": 1
  },
  {
    "code": "google/gemini-2.5-pro-preview-05-06",
    "name": "Gemini 2.5 Pro Preview 05-06",
    "provider": "google",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 1048576,
    "tier": 1
  },
  {
    "code": "meta/muse-spark-1.1",
    "name": "Muse Spark 1.1",
    "provider": "meta",
    "inputPerM": 1.25,
    "outputPerM": 4.25,
    "context": 1048576,
    "tier": 3
  },
  {
    "code": "openai/gpt-5",
    "name": "GPT-5",
    "provider": "openai",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.1",
    "name": "GPT-5.1",
    "provider": "openai",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.1-codex",
    "name": "GPT-5.1-Codex",
    "provider": "openai",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.1-codex-max",
    "name": "GPT-5.1-Codex-Max",
    "provider": "openai",
    "inputPerM": 1.25,
    "outputPerM": 10,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "x-ai/grok-4.20",
    "name": "Grok 4.20",
    "provider": "x-ai",
    "inputPerM": 1.25,
    "outputPerM": 2.5,
    "context": 2000000,
    "tier": 1
  },
  {
    "code": "x-ai/grok-4.20-multi-agent",
    "name": "Grok 4.20 Multi-Agent",
    "provider": "x-ai",
    "inputPerM": 1.25,
    "outputPerM": 2.5,
    "context": 2000000,
    "tier": 1
  },
  {
    "code": "x-ai/grok-4.3",
    "name": "Grok 4.3",
    "provider": "x-ai",
    "inputPerM": 1.25,
    "outputPerM": 2.5,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "qwen/qwen3.7-max",
    "name": "Qwen3.7 Max",
    "provider": "qwen",
    "inputPerM": 1.475,
    "outputPerM": 4.425,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "google/gemini-3.5-flash",
    "name": "Gemini 3.5 Flash",
    "provider": "google",
    "inputPerM": 1.5,
    "outputPerM": 9,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "google/gemini-3.6-flash",
    "name": "Gemini 3.6 Flash",
    "provider": "google",
    "inputPerM": 1.5,
    "outputPerM": 7.5,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-medium-3-5",
    "name": "Mistral Medium 3.5",
    "provider": "mistralai",
    "inputPerM": 1.5,
    "outputPerM": 7.5,
    "context": 262144,
    "tier": 2
  },
  {
    "code": "openai/gpt-3.5-turbo-instruct",
    "name": "GPT-3.5 Turbo Instruct",
    "provider": "openai",
    "inputPerM": 1.5,
    "outputPerM": 2,
    "context": 4095,
    "tier": 2
  },
  {
    "code": "openai/gpt-5.2",
    "name": "GPT-5.2",
    "provider": "openai",
    "inputPerM": 1.75,
    "outputPerM": 14,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.2-chat",
    "name": "GPT-5.2 Chat",
    "provider": "openai",
    "inputPerM": 1.75,
    "outputPerM": 14,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.2-codex",
    "name": "GPT-5.2-Codex",
    "provider": "openai",
    "inputPerM": 1.75,
    "outputPerM": 14,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.3-chat",
    "name": "GPT-5.3 Chat",
    "provider": "openai",
    "inputPerM": 1.75,
    "outputPerM": 14,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.3-codex",
    "name": "GPT-5.3-Codex",
    "provider": "openai",
    "inputPerM": 1.75,
    "outputPerM": 14,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "ai21/jamba-large-1.7",
    "name": "Jamba Large 1.7",
    "provider": "ai21",
    "inputPerM": 2,
    "outputPerM": 8,
    "context": 256000,
    "tier": 3
  },
  {
    "code": "anthropic/claude-sonnet-5",
    "name": "Claude Sonnet 5",
    "provider": "anthropic",
    "inputPerM": 2,
    "outputPerM": 10,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "google/gemini-3-pro-image",
    "name": "Nano Banana Pro (Gemini 3 Pro Image)",
    "provider": "google",
    "inputPerM": 2,
    "outputPerM": 12,
    "context": 131072,
    "tier": 2
  },
  {
    "code": "google/gemini-3-pro-image-preview",
    "name": "Nano Banana Pro (Gemini 3 Pro Image Preview)",
    "provider": "google",
    "inputPerM": 2,
    "outputPerM": 12,
    "context": 65536,
    "tier": 2
  },
  {
    "code": "google/gemini-3.1-pro-preview",
    "name": "Gemini 3.1 Pro Preview",
    "provider": "google",
    "inputPerM": 2,
    "outputPerM": 12,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "google/gemini-3.1-pro-preview-customtools",
    "name": "Gemini 3.1 Pro Preview Custom Tools",
    "provider": "google",
    "inputPerM": 2,
    "outputPerM": 12,
    "context": 1048576,
    "tier": 2
  },
  {
    "code": "mistralai/mistral-large",
    "name": "Mistral Large",
    "provider": "mistralai",
    "inputPerM": 2,
    "outputPerM": 6,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "mistralai/mistral-large-2407",
    "name": "Mistral Large 2407",
    "provider": "mistralai",
    "inputPerM": 2,
    "outputPerM": 6,
    "context": 131072,
    "tier": 1
  },
  {
    "code": "mistralai/mixtral-8x22b-instruct",
    "name": "Mixtral 8x22B Instruct",
    "provider": "mistralai",
    "inputPerM": 2,
    "outputPerM": 6,
    "context": 65536,
    "tier": 2
  },
  {
    "code": "openai/gpt-4.1",
    "name": "GPT-4.1",
    "provider": "openai",
    "inputPerM": 2,
    "outputPerM": 8,
    "context": 1047576,
    "tier": 1
  },
  {
    "code": "openai/o3",
    "name": "o3",
    "provider": "openai",
    "inputPerM": 2,
    "outputPerM": 8,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "perplexity/sonar-deep-research",
    "name": "Sonar Deep Research",
    "provider": "perplexity",
    "inputPerM": 2,
    "outputPerM": 8,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "perplexity/sonar-reasoning-pro",
    "name": "Sonar Reasoning Pro",
    "provider": "perplexity",
    "inputPerM": 2,
    "outputPerM": 8,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "qwen/qwen3.8-max",
    "name": "Qwen3.8 Max",
    "provider": "qwen",
    "inputPerM": 2,
    "outputPerM": 6,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "x-ai/grok-4.5",
    "name": "Grok 4.5",
    "provider": "x-ai",
    "inputPerM": 2,
    "outputPerM": 6,
    "context": 500000,
    "tier": 1
  },
  {
    "code": "amazon/nova-premier-v1",
    "name": "Nova Premier 1.0",
    "provider": "amazon",
    "inputPerM": 2.5,
    "outputPerM": 12.5,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "cohere/command-a",
    "name": "Command A",
    "provider": "cohere",
    "inputPerM": 2.5,
    "outputPerM": 10,
    "context": 256000,
    "tier": 3
  },
  {
    "code": "cohere/command-r-plus-08-2024",
    "name": "Command R+ (08-2024)",
    "provider": "cohere",
    "inputPerM": 2.5,
    "outputPerM": 10,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-4o",
    "name": "GPT-4o",
    "provider": "openai",
    "inputPerM": 2.5,
    "outputPerM": 10,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-4o-2024-08-06",
    "name": "GPT-4o (2024-08-06)",
    "provider": "openai",
    "inputPerM": 2.5,
    "outputPerM": 10,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-4o-2024-11-20",
    "name": "GPT-4o (2024-11-20)",
    "provider": "openai",
    "inputPerM": 2.5,
    "outputPerM": 10,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5-image-mini",
    "name": "GPT-5 Image Mini",
    "provider": "openai",
    "inputPerM": 2.5,
    "outputPerM": 2,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.4",
    "name": "GPT-5.4",
    "provider": "openai",
    "inputPerM": 2.5,
    "outputPerM": 15,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-audio",
    "name": "GPT Audio",
    "provider": "openai",
    "inputPerM": 2.5,
    "outputPerM": 10,
    "context": 128000,
    "tier": 2
  },
  {
    "code": "aion-labs/aion-3.0",
    "name": "Aion-3.0",
    "provider": "aion-labs",
    "inputPerM": 3,
    "outputPerM": 6,
    "context": 131072,
    "tier": 3
  },
  {
    "code": "anthracite-org/magnum-v4-72b",
    "name": "Magnum v4 72B",
    "provider": "anthracite-org",
    "inputPerM": 3,
    "outputPerM": 5,
    "context": 16384,
    "tier": 3
  },
  {
    "code": "anthropic/claude-sonnet-4",
    "name": "Claude Sonnet 4",
    "provider": "anthropic",
    "inputPerM": 3,
    "outputPerM": 15,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-sonnet-4.5",
    "name": "Claude Sonnet 4.5",
    "provider": "anthropic",
    "inputPerM": 3,
    "outputPerM": 15,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-sonnet-4.6",
    "name": "Claude Sonnet 4.6",
    "provider": "anthropic",
    "inputPerM": 3,
    "outputPerM": 15,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "moonshotai/kimi-k3",
    "name": "Kimi K3",
    "provider": "moonshotai",
    "inputPerM": 3,
    "outputPerM": 15,
    "context": 1048576,
    "tier": 3
  },
  {
    "code": "openai/gpt-3.5-turbo-16k",
    "name": "GPT-3.5 Turbo 16k",
    "provider": "openai",
    "inputPerM": 3,
    "outputPerM": 4,
    "context": 16385,
    "tier": 2
  },
  {
    "code": "perplexity/sonar-pro",
    "name": "Sonar Pro",
    "provider": "perplexity",
    "inputPerM": 3,
    "outputPerM": 15,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "perplexity/sonar-pro-search",
    "name": "Sonar Pro Search",
    "provider": "perplexity",
    "inputPerM": 3,
    "outputPerM": 15,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4.5",
    "name": "Claude Opus 4.5",
    "provider": "anthropic",
    "inputPerM": 5,
    "outputPerM": 25,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4.6",
    "name": "Claude Opus 4.6",
    "provider": "anthropic",
    "inputPerM": 5,
    "outputPerM": 25,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4.7",
    "name": "Claude Opus 4.7",
    "provider": "anthropic",
    "inputPerM": 5,
    "outputPerM": 25,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4.8",
    "name": "Claude Opus 4.8",
    "provider": "anthropic",
    "inputPerM": 5,
    "outputPerM": 25,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-5",
    "name": "Claude Opus 5",
    "provider": "anthropic",
    "inputPerM": 5,
    "outputPerM": 25,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "openai/gpt-4o-2024-05-13",
    "name": "GPT-4o (2024-05-13)",
    "provider": "openai",
    "inputPerM": 5,
    "outputPerM": 15,
    "context": 128000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.5",
    "name": "GPT-5.5",
    "provider": "openai",
    "inputPerM": 5,
    "outputPerM": 30,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.6-sol",
    "name": "GPT-5.6 Sol",
    "provider": "openai",
    "inputPerM": 5,
    "outputPerM": 30,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.6-sol-pro",
    "name": "GPT-5.6 Sol Pro",
    "provider": "openai",
    "inputPerM": 5,
    "outputPerM": 30,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-chat-latest",
    "name": "GPT Chat Latest",
    "provider": "openai",
    "inputPerM": 5,
    "outputPerM": 30,
    "context": 400000,
    "tier": 2
  },
  {
    "code": "sakana/fugu-ultra",
    "name": "Fugu Ultra",
    "provider": "sakana",
    "inputPerM": 5,
    "outputPerM": 30,
    "context": 1000000,
    "tier": 3
  },
  {
    "code": "openai/gpt-5.4-image-2",
    "name": "GPT-5.4 Image 2",
    "provider": "openai",
    "inputPerM": 8,
    "outputPerM": 15,
    "context": 272000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-fable-5",
    "name": "Claude Fable 5",
    "provider": "anthropic",
    "inputPerM": 10,
    "outputPerM": 50,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "anthropic/claude-opus-4.8-fast",
    "name": "Claude Opus 4.8 (Fast)",
    "provider": "anthropic",
    "inputPerM": 10,
    "outputPerM": 50,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-5-fast",
    "name": "Claude Opus 5 (Fast)",
    "provider": "anthropic",
    "inputPerM": 10,
    "outputPerM": 50,
    "context": 1000000,
    "tier": 2
  },
  {
    "code": "openai/gpt-4-turbo",
    "name": "GPT-4 Turbo",
    "provider": "openai",
    "inputPerM": 10,
    "outputPerM": 30,
    "context": 128000,
    "tier": 2
  },
  {
    "code": "openai/gpt-4-turbo-preview",
    "name": "GPT-4 Turbo Preview",
    "provider": "openai",
    "inputPerM": 10,
    "outputPerM": 30,
    "context": 128000,
    "tier": 2
  },
  {
    "code": "openai/gpt-5-image",
    "name": "GPT-5 Image",
    "provider": "openai",
    "inputPerM": 10,
    "outputPerM": 10,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4",
    "name": "Claude Opus 4",
    "provider": "anthropic",
    "inputPerM": 15,
    "outputPerM": 75,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4.1",
    "name": "Claude Opus 4.1",
    "provider": "anthropic",
    "inputPerM": 15,
    "outputPerM": 75,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5-pro",
    "name": "GPT-5 Pro",
    "provider": "openai",
    "inputPerM": 15,
    "outputPerM": 120,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "openai/o1",
    "name": "o1",
    "provider": "openai",
    "inputPerM": 15,
    "outputPerM": 60,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "openai/o3-pro",
    "name": "o3 Pro",
    "provider": "openai",
    "inputPerM": 20,
    "outputPerM": 80,
    "context": 200000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.2-pro",
    "name": "GPT-5.2 Pro",
    "provider": "openai",
    "inputPerM": 21,
    "outputPerM": 168,
    "context": 400000,
    "tier": 1
  },
  {
    "code": "anthropic/claude-opus-4.7-fast",
    "name": "Claude Opus 4.7 (Fast)",
    "provider": "anthropic",
    "inputPerM": 30,
    "outputPerM": 150,
    "context": 1000000,
    "tier": 1
  },
  {
    "code": "openai/gpt-4",
    "name": "GPT-4",
    "provider": "openai",
    "inputPerM": 30,
    "outputPerM": 60,
    "context": 8191,
    "tier": 2
  },
  {
    "code": "openai/gpt-5.4-pro",
    "name": "GPT-5.4 Pro",
    "provider": "openai",
    "inputPerM": 30,
    "outputPerM": 180,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/gpt-5.5-pro",
    "name": "GPT-5.5 Pro",
    "provider": "openai",
    "inputPerM": 30,
    "outputPerM": 180,
    "context": 1050000,
    "tier": 1
  },
  {
    "code": "openai/o1-pro",
    "name": "o1-pro",
    "provider": "openai",
    "inputPerM": 150,
    "outputPerM": 600,
    "context": 200000,
    "tier": 1
  }
];

  function formatPrice(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "$—";
    if (x === 0) return "$0";
    if (x >= 10) {
      const s = (Math.round(x * 100) / 100).toFixed(2).replace(/\.00$/, "");
      return "$" + s;
    }
    if (x >= 1) return "$" + String(Math.round(x * 100) / 100);
    if (x >= 0.1) return "$" + String(Math.round(x * 1000) / 1000);
    return "$" + String(Math.round(x * 10000) / 10000);
  }

  function modelLabel(m) {
    return m?.name || m?.code || "";
  }

  function shortId(m) {
    const id = m?.code || "";
    const i = id.indexOf("/");
    return i >= 0 ? id.slice(i + 1) : id;
  }

  /**
   * Levels still ramp difficulty:
   * 1 = familiar flagships, 2 = major providers, 3+ = growing toward full catalog.
   */
  function poolForLevel(level) {
    const n = Number(level);
    if (n <= 1) return MODELS.filter((m) => m.tier === 1);
    if (n === 2) return MODELS.filter((m) => m.tier <= 2);
    if (n === 3) {
      const base = MODELS.filter((m) => m.tier <= 2);
      const extra = MODELS.filter((m) => m.tier === 3);
      const take = Math.min(extra.length, Math.max(40, Math.floor(extra.length * 0.35)));
      return base.concat(extra.slice(0, take));
    }
    if (n === 4) {
      const base = MODELS.filter((m) => m.tier <= 2);
      const extra = MODELS.filter((m) => m.tier === 3);
      const take = Math.min(extra.length, Math.max(80, Math.floor(extra.length * 0.7)));
      return base.concat(extra.slice(0, take));
    }
    // level 5 / full
    return MODELS.slice();
  }

  function poolForHardLevel(level) {
    const n = Number(level);
    if (n <= 1) return MODELS.filter((m) => m.tier <= 2);
    if (n === 2) return MODELS.filter((m) => m.tier >= 2);
    if (n === 3) return MODELS.filter((m) => m.tier === 3 || m.inputPerM >= 1);
    if (n === 4) return MODELS.filter((m) => m.tier === 3 || m.inputPerM >= 0.5);
    return MODELS.slice();
  }

  function similarByPrice(correct, pool, field, count) {
    const key = field === "output" ? "outputPerM" : "inputPerM";
    const target = Number(correct[key]);
    return pool
      .filter((m) => m.code !== correct.code)
      .map((m) => ({ m, d: Math.abs(Number(m[key]) - target) }))
      .filter((x) => x.d > 0)
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.max(0, count))
      .map((x) => x.m);
  }

  root.ModelsQuizData = {
    models: MODELS,
    formatPrice,
    modelLabel,
    shortId,
    poolForLevel,
    poolForHardLevel,
    similarByPrice,
    SNAPSHOT_NOTE: "OpenRouter public /api/v1/models pricing snapshot (full priced catalog)",
  };
})(window);
