export interface OfficialResponseInput {
  wardName?: string | null;
  departmentName?: string | null;
  issueCode?: string | null;
  issueTitle?: string | null;
  detailNote: string;
}

const DEFAULT_RESOLUTION_BY_CATEGORY: Record<string, string> = {
  ROAD_SURFACE:
    'Đơn vị chuyên môn đã tổ chức kiểm tra hiện trường, tiến hành khắc phục hư hỏng mặt đường/vỉa hè và nghiệm thu bảo đảm an toàn giao thông.',
  WASTE:
    'Đơn vị môi trường đã phối hợp thu gom dứt điểm lượng rác thải tồn đọng, vệ sinh sạch sẽ khu vực và tăng cường nhắc nhở đổ rác đúng nơi quy định.',
  STREET_LIGHT:
    'Đơn vị kỹ thuật đã kiểm tra hệ thống chiếu sáng, sửa chữa/thay thế thiết bị hư hỏng và vận hành kiểm tra ổn định vào ban đêm.',
  FLOODING:
    'Đội thoát nước đã tiến hành khơi thông dòng chảy, nạo vét bùn đất tại hố ga/rãnh thoát nước và xử lý điểm ngập úng.',
  OTHER:
    'UBND địa phương đã giao bộ phận chuyên môn phối hợp kiểm tra thực tế và xử lý khắc phục kịp thời bảo đảm an toàn, mỹ quan đô thị.',
};

export function getDefaultResolutionDetail(categoryCode?: string | null): string {
  if (categoryCode && DEFAULT_RESOLUTION_BY_CATEGORY[categoryCode]) {
    return DEFAULT_RESOLUTION_BY_CATEGORY[categoryCode];
  }
  return DEFAULT_RESOLUTION_BY_CATEGORY.OTHER;
}

/**
 * Strips greeting/closing lines when an officer submits a full official letter
 * so timeline events stay concise and readable.
 */
export function extractResolutionSummary(note: string): string {
  const trimmed = note.trim();
  if (!/^kính gửi:/i.test(trimmed)) {
    return trimmed;
  }
  const paragraphs = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length >= 3) {
    return paragraphs[2];
  }
  return trimmed;
}

/**
 * Wraps a resolution detail note into the standardized municipal official response format
 * unless the caller already supplied a full letter starting with "Kính gửi:".
 */
export function formatOfficialResolutionResponse({
  wardName,
  departmentName,
  issueCode,
  issueTitle,
  detailNote,
}: OfficialResponseInput): string {
  const cleanedDetail = detailNote.trim();
  if (!cleanedDetail) {
    return '';
  }
  if (/^kính gửi:/i.test(cleanedDetail)) {
    return cleanedDetail;
  }

  const normalizedWard = wardName?.trim() || 'Phường Trấn Biên';
  const normalizedDept = departmentName?.trim();
  const unitIntro = normalizedDept
    ? `${normalizedDept} - UBND ${normalizedWard}`
    : `UBND ${normalizedWard}`;

  const issueRefParts = [issueCode?.trim(), issueTitle?.trim()].filter(Boolean);
  const issueRef =
    issueRefParts.length > 0 ? ` (${issueRefParts.join(' - ')})` : '';

  return [
    'Kính gửi: Ông/Bà',
    '',
    `Vấn đề Ông/Bà phản ánh${issueRef}, ${unitIntro} xin thông báo kết quả như sau:`,
    '',
    cleanedDetail,
    '',
    'Xin trân trọng cảm ơn Ông/Bà.',
    '',
    `UBND ${normalizedWard}`,
  ].join('\n');
}

