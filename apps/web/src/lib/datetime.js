const KOREAN_TIMEZONE = "Asia/Seoul";

export function formatKoreanDateTime(value) {
  if (!value) {
    return "";
  }

  const source = String(value).trim();
  if (!source) {
    return "";
  }

  if (/[오전오후]/.test(source) && source.includes("월") && source.includes("일")) {
    return source;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return source;
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KOREAN_TIMEZONE,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const month = Number(lookup.month || 0);
  const day = Number(lookup.day || 0);
  const hour = Number(lookup.hour || 0);
  const minute = Number(lookup.minute || 0);
  const second = Number(lookup.second || 0);
  const dayPeriod = lookup.dayPeriod || "";

  if (!month || !day) {
    return source;
  }

  return `${month}월 ${day}일 ${dayPeriod} ${hour}시 ${minute}분 ${second}초`.replace(/\s+/g, " ").trim();
}

export { KOREAN_TIMEZONE };
