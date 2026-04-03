#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""使用mammoth将docx完整转换为markdown"""

import mammoth
import os
from bs4 import BeautifulSoup

def convert_docx_to_markdown_complete(docx_path):
    """使用mammoth将docx完整转换为markdown"""

    # 使用mammoth将docx转换为HTML
    with open(docx_path, 'rb') as docx_file:
        result = mammoth.convert_to_html(docx_file)
        html_content = result.value
        messages = result.messages

    # 打印转换过程中的消息（如果有）
    if messages:
        print("转换消息:")
        for msg in messages:
            print(f"  - {msg}")

    # 使用BeautifulSoup解析HTML
    soup = BeautifulSoup(html_content, 'html.parser')

    # 将HTML转换为Markdown
    markdown_content = html_to_markdown(soup)

    return markdown_content

def html_to_markdown(soup):
    """将BeautifulSoup解析的HTML转换为Markdown"""

    markdown_lines = []

    for element in soup.children:
        if element.name:
            processed = process_element(element)
            if processed:
                markdown_lines.append(processed)
        elif element.string and element.string.strip():
            markdown_lines.append(element.string.strip())

    return '\n\n'.join(markdown_lines)

def process_element(element, indent_level=0):
    """处理单个HTML元素转换为Markdown"""

    if element.name == 'h1':
        return '# ' + get_text(element)
    elif element.name == 'h2':
        return '## ' + get_text(element)
    elif element.name == 'h3':
        return '### ' + get_text(element)
    elif element.name == 'h4':
        return '#### ' + get_text(element)
    elif element.name == 'h5':
        return '##### ' + get_text(element)
    elif element.name == 'h6':
        return '###### ' + get_text(element)
    elif element.name == 'p':
        text = process_inline_elements(element)
        return text if text else ''
    elif element.name == 'table':
        return process_table(element)
    elif element.name == 'ul':
        return process_list(element, unordered=True, indent_level=indent_level)
    elif element.name == 'ol':
        return process_list(element, unordered=False, indent_level=indent_level)
    elif element.name == 'br':
        return '\n'
    elif element.name == 'strong' or element.name == 'b':
        text = get_text(element)
        return '**' + text + '**' if text else ''
    elif element.name == 'em' or element.name == 'i':
        text = get_text(element)
        return '*' + text + '*' if text else ''
    elif element.name == 'u':
        text = get_text(element)
        return '<u>' + text + '</u>' if text else ''
    elif element.name == 'code':
        text = get_text(element)
        return '`' + text + '`' if text else ''
    elif element.name == 'pre':
        text = get_text(element)
        return '\n```\n' + text + '\n```\n'
    elif element.name == 'blockquote':
        lines = []
        for child in element.children:
            if child.name:
                child_text = process_element(child)
                if child_text:
                    lines.append('> ' + child_text)
            elif child.string and child.string.strip():
                lines.append('> ' + child.string.strip())
        return '\n'.join(lines)
    elif element.name == 'div' or element.name == 'section':
        lines = []
        for child in element.children:
            if child.name:
                child_text = process_element(child)
                if child_text:
                    lines.append(child_text)
            elif child.string and child.string.strip():
                lines.append(child.string.strip())
        return '\n'.join(lines)
    else:
        text = get_text(element)
        return text if text else ''

def process_inline_elements(element):
    """处理段落中的内联元素"""
    result = []

    for child in element.children:
        if child.name:
            processed = process_element(child)
            if processed:
                result.append(processed)
        elif child.string:
            result.append(child.string)

    return ''.join(result).strip()

def process_table(table):
    """处理表格转换为Markdown表格"""

    rows = table.find_all('tr')
    if not rows:
        return ''

    header_row = rows[0]
    header_cells = []

    th_cells = header_row.find_all('th')
    td_cells = header_row.find_all('td')

    if th_cells:
        for cell in th_cells:
            cell_text = get_cell_text(cell)
            header_cells.append(cell_text)
    elif td_cells:
        for cell in td_cells:
            cell_text = get_cell_text(cell)
            header_cells.append(cell_text)

    if not header_cells:
        return ''

    markdown_table = []
    markdown_table.append('| ' + ' | '.join(header_cells) + ' |')
    markdown_table.append('| ' + ' | '.join(['---' for _ in header_cells]) + ' |')

    for row in rows[1:]:
        cells = row.find_all(['td', 'th'])
        if not cells:
            continue

        cell_texts = []
        for cell in cells:
            cell_text = get_cell_text(cell)
            cell_texts.append(cell_text)

        if len(cell_texts) < len(header_cells):
            cell_texts.extend(['' for _ in range(len(header_cells) - len(cell_texts))])
        elif len(cell_texts) > len(header_cells):
            cell_texts = cell_texts[:len(header_cells)]

        markdown_table.append('| ' + ' | '.join(cell_texts) + ' |')

    return '\n'.join(markdown_table)

def get_cell_text(cell):
    """获取单元格文本"""
    parts = []
    for child in cell.children:
        if child.name:
            processed = process_element(child)
            if processed:
                parts.append(processed)
        elif child.string:
            parts.append(child.string)

    text = ''.join(parts).strip()
    text = text.replace('\n', ' ').replace('\r', ' ')
    return text

def process_list(list_element, unordered=True, indent_level=0):
    """处理列表"""
    items = list_element.find_all('li', recursive=False)
    lines = []

    for i, item in enumerate(items):
        item_text = process_inline_elements(item)
        indent = '  ' * indent_level

        if unordered:
            lines.append(indent + '- ' + item_text)
        else:
            lines.append(indent + f'{i + 1}. ' + item_text)

        nested_lists = item.find_all(['ul', 'ol'], recursive=False)
        for nested_list in nested_lists:
            nested_text = process_list(nested_list,
                                       unordered=(nested_list.name == 'ul'),
                                       indent_level=indent_level + 1)
            lines.append(nested_text)

    return '\n'.join(lines)

def get_text(element):
    """获取元素的纯文本内容"""
    return element.get_text().strip()

def main():
    docx_file = 'IT项目成本估算监控系统.docx'
    output_file = 'IT项目成本估算监控系统.md'

    try:
        print("开始转换...")
        markdown_content = convert_docx_to_markdown_complete(docx_file)

        header = """---
title: IT项目成本估算监控系统
subtitle: 用户需求说明书
author: 胡月
date: 2026年3月30日
---

"""

        full_content = header + markdown_content

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_content)

        print(f'\n转换成功！文件已保存到: {output_file}')
        print(f'文件大小: {len(full_content)} 字符')
        print(f'内容行数: {len(full_content.splitlines())} 行')

    except Exception as e:
        print(f'转换失败: {str(e)}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()