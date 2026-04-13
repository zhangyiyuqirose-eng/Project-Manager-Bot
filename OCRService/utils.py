"""
数据提取与转换工具
从 OCR 结果中提取业务数据
"""
import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


# 财务数据提取的正则模式
FINANCIAL_PATTERNS = {
    'contractAmount': [
        r'合同金额[：:]\s*(\d+\.?\d*)\s*万元',
        r'合同总额[：:]\s*(\d+\.?\d*)\s*万',
        r'合同价[：:]\s*(\d+\.?\d*)\s*万元',
        r'金额[：:]\s*(\d+\.?\d*)\s*万元',
    ],
    'preSaleRatio': [
        r'售前比例[：:]\s*(\d+\.?\d*)\s*%',
        r'售前占比[：:]\s*(\d+\.?\d*)\s*%',
        r'预售比例[：:]\s*(\d+\.?\d*)\s*%',
    ],
    'taxRate': [
        r'税率[：:]\s*(\d+\.?\d*)\s*%',
        r'增值税率[：:]\s*(\d+\.?\d*)\s*%',
        r'税点[：:]\s*(\d+\.?\d*)\s*%',
    ],
    'currentManpowerCost': [
        r'人力成本[：:]\s*(\d+\.?\d*)\s*万元',
        r'已投入成本[：:]\s*(\d+\.?\d*)\s*万',
        r'当前成本[：:]\s*(\d+\.?\d*)\s*万元',
        r'人力投入[：:]\s*(\d+\.?\d*)\s*万元',
    ],
    'externalLaborCost': [
        r'外采人力[：:]\s*(\d+\.?\d*)\s*万元',
        r'外包人力[：:]\s*(\d+\.?\d*)\s*万',
        r'外部人力成本[：:]\s*(\d+\.?\d*)\s*万元',
    ],
    'externalSoftwareCost': [
        r'外采软件[：:]\s*(\d+\.?\d*)\s*万元',
        r'软件采购[：:]\s*(\d+\.?\d*)\s*万',
        r'外部软件成本[：:]\s*(\d+\.?\d*)\s*万元',
    ],
}

# 偏差监控相关模式
DEVIATION_PATTERNS = {
    'projectName': [
        r'项目名称[：:]\s*(.+?)(?:\n|$)',
        r'项目[：:]\s*(.+?)(?:\n|$)',
    ],
    'taskProgress': [
        r'进度[：:]\s*(\d+\.?\d*)\s*%',
        r'完成进度[：:]\s*(\d+\.?\d*)\s*%',
        r'任务进度[：:]\s*(\d+\.?\d*)\s*%',
    ],
}


def extract_value(text: str, patterns: List[str], default: float = 0) -> float:
    """
    使用多个正则模式尝试提取数值

    Args:
        text: 待提取的文本
        patterns: 正则模式列表
        default: 默认值

    Returns:
        提取到的数值
    """
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except (ValueError, IndexError):
                continue
    return default


def extract_string(text: str, patterns: List[str]) -> str:
    """
    提取字符串值

    Args:
        text: 待提取的文本
        patterns: 正则模式列表

    Returns:
        提取到的字符串
    """
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def extract_financial_data(ocr_result: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    从 OCR 结果提取财务数据（成本消耗预估格式）

    Args:
        ocr_result: OCR 识别结果

    Returns:
        结构化的财务数据
    """
    # 合并所有文本
    full_text = '\n'.join([item.get('text', '') for item in ocr_result])

    result = {
        'contractAmount': 0.0,
        'preSaleRatio': 0.0,
        'taxRate': 0.06,  # 默认税率
        'externalLaborCost': 0.0,
        'externalSoftwareCost': 0.0,
        'currentManpowerCost': 0.0,
        'members': [],
        'rawText': full_text
    }

    # 提取各项数值
    result['contractAmount'] = extract_value(
        full_text, FINANCIAL_PATTERNS['contractAmount']
    )

    # 售前比例需要转换为小数
    pre_sale_percent = extract_value(
        full_text, FINANCIAL_PATTERNS['preSaleRatio']
    )
    result['preSaleRatio'] = pre_sale_percent / 100 if pre_sale_percent > 0 else 0

    # 税率转换为小数
    tax_percent = extract_value(
        full_text, FINANCIAL_PATTERNS['taxRate']
    )
    result['taxRate'] = tax_percent / 100 if tax_percent > 0 else 0.06

    result['currentManpowerCost'] = extract_value(
        full_text, FINANCIAL_PATTERNS['currentManpowerCost']
    )

    result['externalLaborCost'] = extract_value(
        full_text, FINANCIAL_PATTERNS['externalLaborCost']
    )

    result['externalSoftwareCost'] = extract_value(
        full_text, FINANCIAL_PATTERNS['externalSoftwareCost']
    )

    # 提取成员信息
    result['members'] = extract_member_info(full_text)

    logger.info(f"Extracted financial data: {result}")
    return result


def extract_project_data(ocr_result: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    从 OCR 结果提取项目数据（偏差监控格式）

    Args:
        ocr_result: OCR 识别结果

    Returns:
        结构化的项目数据
    """
    full_text = '\n'.join([item.get('text', '') for item in ocr_result])

    result = {
        'projectName': '',
        'contractAmount': 0.0,
        'currentManpowerCost': 0.0,
        'taskProgress': 0.0,
        'members': [],
        'rawText': full_text
    }

    # 提取项目名称
    result['projectName'] = extract_string(
        full_text, DEVIATION_PATTERNS['projectName']
    )

    # 提取任务进度
    result['taskProgress'] = extract_value(
        full_text, DEVIATION_PATTERNS['taskProgress']
    )

    # 复用财务数据提取
    financial = extract_financial_data(ocr_result)
    result['contractAmount'] = financial['contractAmount']
    result['currentManpowerCost'] = financial['currentManpowerCost']
    result['members'] = financial['members']

    logger.info(f"Extracted project data: {result}")
    return result


def extract_member_info(full_text: str) -> List[Dict[str, Any]]:
    """
    提取成员信息

    Args:
        full_text: 完整文本

    Returns:
        成员信息列表
    """
    members = []

    # 尝试匹配表格形式的成员信息
    # 格式: 姓名 职级 角色 工时
    member_pattern = re.compile(
        r'(\S+)\s+(P[5-8])\s+(\S+)\s+(\d+\.?\d*)\s*(?:小时|h)?',
        re.IGNORECASE
    )

    matches = member_pattern.findall(full_text)
    for match in matches:
        members.append({
            'name': match[0],
            'level': match[1],
            'role': match[2],
            'reportedHours': float(match[3])
        })

    # 如果上面没匹配到，尝试其他格式
    if not members:
        # 尝试匹配更简单的格式
        simple_pattern = re.compile(
            r'([\u4e00-\u9fa5]{2,4})\s*[:：]\s*(\d+\.?\d*)\s*(?:小时|h)?'
        )
        simple_matches = simple_pattern.findall(full_text)
        for match in simple_matches:
            members.append({
                'name': match[0],
                'level': 'P6',  # 默认职级
                'role': '成员',
                'reportedHours': float(match[1])
            })

    return members


def format_ocr_result(ocr_result: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    格式化基础 OCR 结果

    Args:
        ocr_result: OCR 识别结果

    Returns:
        格式化后的结果
    """
    text_lines = []
    for item in ocr_result:
        text_lines.append({
            'text': item.get('text', ''),
            'confidence': item.get('confidence', 0),
            'bounding_box': item.get('bounding_box', [])
        })

    return {
        'text_lines': text_lines,
        'full_text': '\n'.join([item['text'] for item in text_lines])
    }