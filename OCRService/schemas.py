"""
Pydantic 数据模型定义
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class ExtractType(str, Enum):
    """数据提取类型"""
    CONSUMPTION = "consumption"  # 成本消耗预估
    DEVIATION = "deviation"      # 偏差监控


class OCRRequest(BaseModel):
    """基础 OCR 请求"""
    image: str = Field(..., description="Base64 编码的图片")
    language: str = Field(default="ch", description="语言，默认中文")


class StructuredOCRRequest(BaseModel):
    """结构化数据提取请求"""
    image: str = Field(..., description="Base64 编码的图片")
    extract_type: ExtractType = Field(
        default=ExtractType.CONSUMPTION,
        description="提取类型：consumption(成本消耗) 或 deviation(偏差监控)"
    )


class OCRBatchRequest(BaseModel):
    """批量 OCR 请求"""
    images: List[dict] = Field(..., description="图片列表，每项包含 image 和 type")


class MemberInfo(BaseModel):
    """成员信息"""
    name: str = Field(default="", description="姓名")
    level: str = Field(default="", description="职级 P5/P6/P7/P8")
    role: str = Field(default="", description="角色")
    reportedHours: float = Field(default=0, description="已报工时")


class ConsumptionResult(BaseModel):
    """成本消耗预估结果"""
    contractAmount: float = Field(default=0, description="合同金额(万元)")
    preSaleRatio: float = Field(default=0, description="售前比例(小数)")
    taxRate: float = Field(default=0.06, description="税率(小数)")
    externalLaborCost: float = Field(default=0, description="外采人力成本(万元)")
    externalSoftwareCost: float = Field(default=0, description="外采软件成本(万元)")
    currentManpowerCost: float = Field(default=0, description="当前人力成本(万元)")
    members: List[MemberInfo] = Field(default=[], description="成员列表")
    rawText: str = Field(default="", description="原始识别文本")


class DeviationResult(BaseModel):
    """偏差监控结果"""
    projectName: str = Field(default="", description="项目名称")
    contractAmount: float = Field(default=0, description="合同金额(万元)")
    currentManpowerCost: float = Field(default=0, description="当前人力成本(万元)")
    taskProgress: float = Field(default=0, description="任务进度(%)")
    members: List[MemberInfo] = Field(default=[], description="成员列表")
    rawText: str = Field(default="", description="原始识别文本")


class OCRLineResult(BaseModel):
    """单行 OCR 结果"""
    text: str = Field(description="识别文本")
    confidence: float = Field(description="置信度")
    bounding_box: List[List[float]] = Field(description="边界框坐标")


class OCRRecognizeResult(BaseModel):
    """基础 OCR 识别结果"""
    text_lines: List[OCRLineResult] = Field(description="识别行列表")
    full_text: str = Field(description="完整文本")


class APIResponse(BaseModel):
    """API 响应格式"""
    code: int = Field(default=200, description="状态码")
    message: str = Field(default="success", description="消息")
    data: dict = Field(default={}, description="数据")