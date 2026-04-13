"""
OCR API Service
FastAPI 主应用 - 使用 EasyOCR
"""
import base64
import io
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np

from schemas import (
    OCRRequest,
    StructuredOCRRequest,
    OCRBatchRequest,
    APIResponse,
    ExtractType
)
from ocr_engine import get_engine
from utils import (
    extract_financial_data,
    extract_project_data,
    format_ocr_result
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title="OCR Service",
    description="本地 OCR 识别服务，使用 EasyOCR，支持结构化数据提取",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def decode_base64_image(base64_str: str) -> np.ndarray:
    """
    解码 base64 图片为 numpy 数组

    Args:
        base64_str: base64 编码的图片字符串

    Returns:
        numpy 图片数组
    """
    try:
        # 移除可能的 data URL 前缀
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]

        image_bytes = base64.b64decode(base64_str)
        image = Image.open(io.BytesIO(image_bytes))

        # 转换为 RGB 模式（如果需要）
        if image.mode != 'RGB':
            image = image.convert('RGB')

        return np.array(image)

    except Exception as e:
        logger.error(f"Failed to decode base64 image: {e}")
        raise ValueError(f"Invalid base64 image: {e}")


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化 OCR 引擎"""
    logger.info("Starting OCR Service...")
    engine = get_engine()
    if engine.initialize():
        logger.info("OCR Engine initialized successfully")
    else:
        logger.warning("OCR Engine initialization failed, will retry on first request")


@app.get("/health")
async def health_check():
    """健康检查端点"""
    engine = get_engine()
    return {
        "status": "ok",
        "service": "easyocr",
        "version": "1.0.0",
        "engine_ready": engine.is_ready()
    }


@app.post("/ocr/recognize", response_model=APIResponse)
async def recognize_single(request: OCRRequest):
    """
    单张图片 OCR 识别（基础接口）

    返回所有识别到的文本行及其置信度
    """
    try:
        image = decode_base64_image(request.image)
        engine = get_engine()

        if not engine.is_ready():
            if not engine.initialize():
                raise HTTPException(status_code=503, detail="OCR Engine not available")

        result = engine.recognize(image)
        formatted = format_ocr_result(result)

        return APIResponse(
            code=200,
            message="success",
            data=formatted
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"OCR recognition failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr/structured", response_model=APIResponse)
async def structured_extract(request: StructuredOCRRequest):
    """
    结构化数据提取（核心接口）

    根据提取类型返回不同格式的结构化数据：
    - consumption: 成本消耗预估格式
    - deviation: 偏差监控格式
    """
    try:
        image = decode_base64_image(request.image)
        engine = get_engine()

        if not engine.is_ready():
            if not engine.initialize():
                raise HTTPException(status_code=503, detail="OCR Engine not available")

        # 执行 OCR 识别
        ocr_result = engine.recognize(image)

        # 根据提取类型处理结果
        if request.extract_type == ExtractType.CONSUMPTION:
            data = extract_financial_data(ocr_result)
        elif request.extract_type == ExtractType.DEVIATION:
            data = extract_project_data(ocr_result)
        else:
            data = format_ocr_result(ocr_result)

        return APIResponse(
            code=200,
            message="success",
            data=data
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Structured extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ocr/recognize-batch", response_model=APIResponse)
async def recognize_batch(request: OCRBatchRequest):
    """
    批量图片 OCR 识别

    处理多张图片并合并结果
    """
    try:
        engine = get_engine()

        if not engine.is_ready():
            if not engine.initialize():
                raise HTTPException(status_code=503, detail="OCR Engine not available")

        all_results = []

        for item in request.images:
            image = decode_base64_image(item.get('image', ''))
            ocr_result = engine.recognize(image)
            all_results.extend(ocr_result)

        # 合并结果
        data = extract_financial_data(all_results)

        return APIResponse(
            code=200,
            message="success",
            data=data
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Batch recognition failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "code": 500,
            "message": f"Internal server error: {str(exc)}",
            "data": None
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8868)