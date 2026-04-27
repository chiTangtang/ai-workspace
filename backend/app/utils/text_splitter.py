"""
文本分块模块
将长文本按照指定大小分割成多个块，支持重叠以保持上下文连贯性
"""


class TextSplitter:
    """文本分块器"""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        """
        初始化文本分块器
        :param chunk_size: 每个文本块的最大字符数
        :param chunk_overlap: 相邻文本块之间的重叠字符数
        """
        if chunk_overlap >= chunk_size:
            raise ValueError("重叠字符数必须小于块大小")

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> list[str]:
        """
        将文本分割成多个块
        :param text: 要分割的文本
        :return: 文本块列表
        """
        if not text or not text.strip():
            return []

        # 预处理：去除多余空白
        text = text.strip()

        # 如果文本长度不超过块大小，直接返回
        if len(text) <= self.chunk_size:
            return [text]

        chunks = []
        start = 0

        while start < len(text):
            end = start + self.chunk_size

            # 如果已经到达文本末尾
            if end >= len(text):
                chunks.append(text[start:])
                break

            # 尝试在句子边界处分割（优先在句号、换行等位置断开）
            best_break = self._find_break_point(text, start, end)

            chunk = text[start:best_break].strip()
            if chunk:
                chunks.append(chunk)

            # 移动到下一个块的起始位置（减去重叠部分）
            start = best_break - self.chunk_overlap

            # 避免死循环：确保 start 至少前进 1 个字符
            chunks_start = (len(chunks) - 1) * (self.chunk_size - self.chunk_overlap)
            if start <= chunks_start and len(chunks) > 1:
                start = best_break
                continue

        return chunks

    def _find_break_point(self, text: str, start: int, end: int) -> int:
        """
        在 [start, end] 范围内寻找最佳分割点
        优先在段落、句子、空格处分割
        :param text: 原始文本
        :param start: 起始位置
        :param end: 结束位置
        :return: 最佳分割点位置
        """
        # 在 end 之前的 100 个字符内寻找分割点
        search_start = max(start, end - 100)
        search_text = text[search_start:end]

        # 优先级 1：段落分割（双换行）
        for sep in ["\n\n", "\n"]:
            last_pos = search_text.rfind(sep)
            if last_pos != -1:
                return search_start + last_pos + len(sep)

        # 优先级 2：句子分割（中英文句号、问号、感叹号）
        for sep in ["。", ".", "！", "!", "？", "?", "；", ";"]:
            last_pos = search_text.rfind(sep)
            if last_pos != -1:
                return search_start + last_pos + 1

        # 优先级 3：逗号分割
        for sep in ["，", ",", "：", ":"]:
            last_pos = search_text.rfind(sep)
            if last_pos != -1:
                return search_start + last_pos + 1

        # 优先级 4：空格分割
        last_space = search_text.rfind(" ")
        if last_space != -1:
            return search_start + last_space + 1

        # 没有找到合适的分割点，直接在 end 处分割
        return end
