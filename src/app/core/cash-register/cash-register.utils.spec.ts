import { makeCashRegisterLine, makeCashRegisterPaymentTotal } from '../../../testing/builders';
import {
  groupPaymentTotals,
  groupReconciliationLines,
  groupReconciliationLinesForBrand,
  paymentGroupLabel,
  paymentGroupOf,
} from './cash-register.utils';

describe('cash-register payment grouping', () => {
  it('maps credit and debit to the Card group and keeps others as-is', () => {
    expect(paymentGroupOf('CreditCard')).toBe('Card');
    expect(paymentGroupOf('DebitCard')).toBe('Card');
    expect(paymentGroupOf('Cash')).toBe('Cash');
    expect(paymentGroupOf('Transfer')).toBe('Transfer');
    expect(paymentGroupLabel('Card')).toBe('Tarjeta (Crédito + Débito)');
  });

  describe('groupPaymentTotals', () => {
    it('merges credit + debit into a single Tarjeta line, ordered canonically', () => {
      const grouped = groupPaymentTotals([
        makeCashRegisterPaymentTotal({
          paymentMethod: 'Transfer',
          grossSalesAmount: 200,
          returnsAmount: 0,
          netAmount: 200,
        }),
        makeCashRegisterPaymentTotal({
          paymentMethod: 'CreditCard',
          grossSalesAmount: 500,
          returnsAmount: 0,
          netAmount: 500,
          reportedAmount: 500,
          varianceAmount: 0,
        }),
        makeCashRegisterPaymentTotal({
          paymentMethod: 'DebitCard',
          grossSalesAmount: 350,
          returnsAmount: 50,
          netAmount: 300,
          reportedAmount: 280,
          varianceAmount: -20,
        }),
        makeCashRegisterPaymentTotal({
          paymentMethod: 'Cash',
          grossSalesAmount: 1000,
          returnsAmount: 0,
          netAmount: 1000,
        }),
      ]);

      expect(grouped.map((g) => g.group)).toEqual(['Cash', 'Card', 'Transfer']);

      const card = grouped.find((g) => g.group === 'Card')!;
      expect(card.grossSalesAmount).toBe(850);
      expect(card.returnsAmount).toBe(50);
      expect(card.netAmount).toBe(800);
      expect(card.reportedAmount).toBe(780);
      expect(card.varianceAmount).toBe(-20);
    });

    it('keeps reported/variance null when no card line reported anything', () => {
      const [card] = groupPaymentTotals([
        makeCashRegisterPaymentTotal({ paymentMethod: 'CreditCard', reportedAmount: null, varianceAmount: null }),
        makeCashRegisterPaymentTotal({ paymentMethod: 'DebitCard', reportedAmount: null, varianceAmount: null }),
      ]);

      expect(card.group).toBe('Card');
      expect(card.reportedAmount).toBeNull();
      expect(card.varianceAmount).toBeNull();
    });
  });

  describe('groupReconciliationLines', () => {
    const lines = [
      makeCashRegisterLine({
        brandId: 'b1',
        brandName: 'Zendra',
        paymentMethod: 'Cash',
        systemGrossSalesAmount: 1000,
        systemReturnsAmount: 0,
        systemNetAmount: 1000,
        saleCount: 2,
        returnCount: 0,
        unitsSold: 2,
        unitsReturned: 0,
        netUnits: 2,
      }),
      makeCashRegisterLine({
        brandId: 'b1',
        brandName: 'Zendra',
        paymentMethod: 'CreditCard',
        systemGrossSalesAmount: 500,
        systemReturnsAmount: 0,
        systemNetAmount: 500,
        saleCount: 1,
        returnCount: 0,
        unitsSold: 1,
        unitsReturned: 0,
        netUnits: 1,
        reportedAmount: 500,
        varianceAmount: 0,
      }),
      makeCashRegisterLine({
        brandId: 'b1',
        brandName: 'Zendra',
        paymentMethod: 'DebitCard',
        systemGrossSalesAmount: 250,
        systemReturnsAmount: 0,
        systemNetAmount: 250,
        saleCount: 1,
        returnCount: 0,
        unitsSold: 1,
        unitsReturned: 0,
        netUnits: 1,
        reportedAmount: 200,
        varianceAmount: -50,
      }),
      makeCashRegisterLine({
        brandId: 'b2',
        brandName: 'Lumina',
        paymentMethod: 'CreditCard',
        systemGrossSalesAmount: 700,
        systemReturnsAmount: 0,
        systemNetAmount: 700,
        saleCount: 1,
        returnCount: 0,
        unitsSold: 1,
        unitsReturned: 0,
        netUnits: 1,
      }),
    ];

    it('collapses a brand credit + debit lines into one Card line', () => {
      const grouped = groupReconciliationLines(lines);

      expect(grouped).toHaveLength(3);

      const b1Card = grouped.find((l) => l.brandId === 'b1' && l.group === 'Card')!;
      expect(b1Card.key).toBe('b1::Card');
      expect(b1Card.systemGrossSalesAmount).toBe(750);
      expect(b1Card.systemNetAmount).toBe(750);
      expect(b1Card.saleCount).toBe(2);
      expect(b1Card.unitsSold).toBe(2);
      expect(b1Card.netUnits).toBe(2);
      expect(b1Card.reportedAmount).toBe(700);
      expect(b1Card.varianceAmount).toBe(-50);

      // Other brands/methods stay independent.
      expect(grouped.find((l) => l.brandId === 'b1' && l.group === 'Cash')!.systemNetAmount).toBe(1000);
      expect(grouped.find((l) => l.brandId === 'b2' && l.group === 'Card')!.systemNetAmount).toBe(700);
    });

    it('filters by brand before grouping', () => {
      const grouped = groupReconciliationLinesForBrand(lines, 'b1');

      expect(grouped.map((l) => l.group)).toEqual(['Cash', 'Card']);
      expect(grouped.every((l) => l.brandId === 'b1')).toBe(true);
    });
  });
});
