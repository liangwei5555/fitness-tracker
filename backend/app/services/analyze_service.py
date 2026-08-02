"""Claude API 照片分析服务"""
import os
import base64
import json
from pathlib import Path

# 加载 .env 文件
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.isfile(ENV_PATH):
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())


def _get_image_base64(filepath: str) -> tuple:
    """读取图片并返回 base64 和 media_type"""
    path = Path(filepath)
    ext = path.suffix.lower()
    media_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_map.get(ext, "image/jpeg")
    with open(filepath, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8"), media_type


def analyze_photo(photo_path: str, view_type: str = "正面") -> dict:
    """使用 Claude API 分析身体照片"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _mock_analysis(view_type)

    image_b64, media_type = _get_image_base64(photo_path)

    system_prompt = """你是一名专业的健身教练和体态评估师。请基于照片分析用户的体态状况。
你需要严格返回 JSON 格式，字段说明：
- posture_assessment: 整体体态评估（200字以内）
- shoulder_diff_cm: 高低肩差值估算（厘米，可以为null）
- spine_alignment: 脊柱排列评估（如"正常""轻微侧弯""明显侧弯"等）
- pelvis_tilt: 骨盆倾斜评估（如"正常""前倾""后倾""左高右低"等）
- recommendations: 针对性的改善建议（每条用分号分隔，3-5条具体建议）

只返回JSON，不要有其他内容。"""

    try:
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"请分析这张{view_type}身体照片的体态状况。",
                    },
                ],
            }],
        )
        raw = message.content[0].text
        # 尝试解析 JSON
        result = json.loads(raw)
        result["raw_response"] = raw
        return result
    except Exception as e:
        return {
            "posture_assessment": f"API 调用失败: {str(e)}",
            "shoulder_diff_cm": None,
            "spine_alignment": None,
            "pelvis_tilt": None,
            "recommendations": "请检查 API Key 配置或网络连接",
            "raw_response": str(e),
        }


def _mock_analysis(view_type: str) -> dict:
    """无 API Key 时的模拟分析结果"""
    return {
        "posture_assessment": "（演示模式）请在 backend/.env 中配置 ANTHROPIC_API_KEY 以启用 AI 分析。",
        "shoulder_diff_cm": 1.5,
        "spine_alignment": "轻微侧弯（演示数据）",
        "pelvis_tilt": "正常（演示数据）",
        "recommendations": "1. 每日靠墙站立5分钟矫正高低肩；2. 加强左侧背部肌肉训练（如单臂哑铃划船）；3. 游泳（自由泳和蛙泳交替）；4. 每周至少2次瑜伽或普拉提；5. 注意日常坐姿，避免单肩背包",
        "raw_response": "MOCK — 未配置 ANTHROPIC_API_KEY",
    }
