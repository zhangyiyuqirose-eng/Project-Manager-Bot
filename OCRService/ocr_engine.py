"""
OCR 引擎封装 - 使用 EasyOCR
提供统一的 OCR 识别接口
"""
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image
import io

logger = logging.getLogger(__name__)


class OCREngine:
    """OCR 引擎封装类 - 使用 EasyOCR"""

    def __init__(self, use_gpu: bool = False, lang: List[str] = None):
        """
        初始化 OCR 引擎

        Args:
            use_gpu: 是否使用 GPU
            lang: 语言列表，默认 ['ch_sim', 'en'] (简体中文和英文)
        """
        self.use_gpu = use_gpu
        self.lang = lang or ['ch_sim', 'en']
        self.reader = None
        self._initialized = False

    def initialize(self) -> bool:
        """
        初始化 OCR 模型

        Returns:
            是否初始化成功
        """
        if self._initialized:
            return True

        try:
            import easyocr

            logger.info(f"Initializing EasyOCR with lang={self.lang}, gpu={self.use_gpu}")

            self.reader = easyocr.Reader(
                self.lang,
                gpu=self.use_gpu,
                download_enabled=True
            )

            self._initialized = True
            logger.info("EasyOCR initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
            return False

    def recognize(
        self,
        image: np.ndarray,
        lang: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        执行 OCR 识别

        Args:
            image: 图片数组 (numpy.ndarray)
            lang: 可选的语言覆盖

        Returns:
            识别结果列表，每项包含 text, confidence, bounding_box
        """
        if not self._initialized or self.reader is None:
            raise RuntimeError("OCR engine not initialized. Call initialize() first.")

        try:
            # EasyOCR 返回格式: [[[x1,y1],[x2,y2],[x3,y3],[x4,y4]], text, confidence]
            results = self.reader.readtext(image)

            formatted_result = []
            for detection in results:
                bounding_box, text, confidence = detection
                formatted_result.append({
                    'text': text,
                    'confidence': float(confidence),
                    'bounding_box': bounding_box
                })

            return formatted_result

        except Exception as e:
            logger.error(f"OCR recognition failed: {e}")
            return []

    def recognize_from_bytes(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        从字节流识别图片

        Args:
            image_bytes: 图片字节流

        Returns:
            识别结果
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image_array = np.array(image)
            return self.recognize(image_array)
        except Exception as e:
            logger.error(f"Failed to process image bytes: {e}")
            return []

    def get_full_text(self, result: List[Dict[str, Any]]) -> str:
        """
        获取完整文本

        Args:
            result: 识别结果

        Returns:
            合并后的完整文本
        """
        return '\n'.join([item['text'] for item in result])

    def is_ready(self) -> bool:
        """检查引擎是否就绪"""
        return self._initialized and self.reader is not None


# 全局引擎实例
_engine: Optional[OCREngine] = None


def get_engine() -> OCREngine:
    """获取全局 OCR 引擎实例"""
    global _engine
    if _engine is None:
        _engine = OCREngine()
    return _engine