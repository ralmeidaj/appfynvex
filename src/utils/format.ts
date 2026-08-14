export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// Inverso de formatDateBR — usado nos campos editáveis de data (RF-ANT-04),
// que exibem/editam no formato BR mas persistem em ISO.
export function parseDateBR(brDate: string): string {
  const [day, month, year] = brDate.split('/');
  return `${year}-${month}-${day}`;
}
