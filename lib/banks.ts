export type Bank = { bin: string; code: string; name: string };

// NAPAS BINs, source: https://api.vietqr.io/v2/banks
export const BANKS: Bank[] = [
  { bin: '970436', code: 'Vietcombank', name: 'Vietcombank' },
  { bin: '970415', code: 'VietinBank', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'Agribank', name: 'Agribank' },
  { bin: '970422', code: 'MBBank', name: 'MB Bank' },
  { bin: '970407', code: 'Techcombank', name: 'Techcombank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPBank', name: 'VPBank' },
  { bin: '970423', code: 'TPBank', name: 'TPBank' },
  { bin: '970403', code: 'Sacombank', name: 'Sacombank' },
  { bin: '970437', code: 'HDBank', name: 'HDBank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970431', code: 'Eximbank', name: 'Eximbank' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970440', code: 'SeABank', name: 'SeABank' },
  { bin: '970449', code: 'LPBank', name: 'LPBank' },
  { bin: '970428', code: 'NamABank', name: 'Nam A Bank' },
  { bin: '970409', code: 'BacABank', name: 'Bac A Bank' },
  { bin: '546034', code: 'CAKE', name: 'Cake by VPBank' },
  { bin: '963388', code: 'Timo', name: 'Timo' },
];

export const bankByBin = (bin: string | null | undefined) => BANKS.find((b) => b.bin === bin);
