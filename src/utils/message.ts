export function interpolateMessage(template: string, count: number): string {
  let result = template.replaceAll("{{.Count}}", count.toString());
  result = result.replaceAll("{{.Timestamp}}", Date.now().toString());
  return result;
}
