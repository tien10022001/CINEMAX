/**
 * DỊCH VỤ TÍNH TIỀN ĐA CHIỀU (TICKETS + CONCESSIONS + COUPONS + LOYALTY)
 */

const { AUDIENCE_MULTIPLIERS, LOYALTY_RATE, LOYALTY_REDEMPTION_RATE } = require('../config/constants');
const dataStore = require('../models/dataStore');

class PricingService {
  /**
   * Tính toán toàn bộ chi phí đơn hàng
   * @param {Array} seats - Danh sách đối tượng ghế
   * @param {Object} audienceTypes - { [seatId]: 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR' }
   * @param {Array} concessions - [ { productId, quantity, modifiers: [modifierId] } ]
   * @param {String} couponCode - Mã giảm giá nếu có
   * @param {Number} loyaltyPointsUsed - Số điểm tích lũy dùng
   */
  calculateOrder(seats, audienceTypes = {}, concessions = [], couponCode = null, loyaltyPointsUsed = 0) {
    // 1. Tính tiền vé
    let ticketSubtotal = 0;
    const ticketBreakdown = seats.map(s => {
      const audType = audienceTypes[s.seat_id] || 'ADULT';
      const multiplier = AUDIENCE_MULTIPLIERS[audType] || 1.0;
      const finalPrice = Math.round(s.base_price * multiplier);
      ticketSubtotal += finalPrice;
      return {
        seat_id: s.seat_id,
        seat_type: s.seat_type,
        base_price: s.base_price,
        audience_type: audType,
        final_price: finalPrice
      };
    });

    // 2. Tính tiền bắp nước F&B
    let concessionSubtotal = 0;
    const concessionBreakdown = concessions.map(c => {
      const product = dataStore.products.find(p => p.id === c.productId);
      if (!product) return null;

      let itemPrice = product.base_price;
      const appliedModifiers = [];

      if (c.modifiers && Array.isArray(c.modifiers)) {
        c.modifiers.forEach(modId => {
          const mod = dataStore.productModifiers.find(m => m.id === modId);
          if (mod) {
            itemPrice += mod.extra_price;
            appliedModifiers.push(mod);
          }
        });
      }

      const lineTotal = itemPrice * (c.quantity || 1);
      concessionSubtotal += lineTotal;

      return {
        product_id: product.id,
        name: product.name,
        quantity: c.quantity || 1,
        unit_price: itemPrice,
        line_total: lineTotal,
        modifiers: appliedModifiers
      };
    }).filter(Boolean);

    const grossTotal = ticketSubtotal + concessionSubtotal;

    // 3. Tính mã giảm giá (Coupon)
    let discountAmount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const coupon = dataStore.coupons.find(cp => cp.code.toUpperCase() === couponCode.trim().toUpperCase() && cp.active);
      if (coupon) {
        let eligibleBase = grossTotal;
        if (coupon.apply_scope === 'TICKET_ONLY') eligibleBase = ticketSubtotal;
        else if (coupon.apply_scope === 'COMBO_ONLY') eligibleBase = concessionSubtotal;

        if (eligibleBase >= (coupon.min_order_amount || 0)) {
          if (coupon.discount_type === 'PERCENT') {
            discountAmount = (eligibleBase * coupon.discount_value) / 100;
            if (coupon.max_discount && discountAmount > coupon.max_discount) {
              discountAmount = coupon.max_discount;
            }
          } else if (coupon.discount_type === 'FIXED') {
            discountAmount = Math.min(coupon.discount_value, eligibleBase);
          }
          appliedCoupon = {
            code: coupon.code,
            discount_amount: discountAmount,
            apply_scope: coupon.apply_scope
          };
        }
      }
    }

    // 4. Khấu trừ điểm tích lũy
    let loyaltyDiscount = 0;
    if (loyaltyPointsUsed > 0) {
      loyaltyDiscount = loyaltyPointsUsed * LOYALTY_REDEMPTION_RATE;
      // Không giảm vượt quá số tiền còn lại sau coupon
      const remainingBeforeLoyalty = Math.max(0, grossTotal - discountAmount);
      loyaltyDiscount = Math.min(loyaltyDiscount, remainingBeforeLoyalty);
    }

    // 5. Tổng thanh toán cuối cùng
    const totalAmount = Math.max(0, grossTotal - discountAmount - loyaltyDiscount);

    // 6. Điểm thưởng nhận được (5% tiền vé)
    const pointsEarned = Math.floor(ticketSubtotal * LOYALTY_RATE);

    return {
      ticket_subtotal: ticketSubtotal,
      ticket_breakdown: ticketBreakdown,
      concession_subtotal: concessionSubtotal,
      concession_breakdown: concessionBreakdown,
      gross_total: grossTotal,
      coupon_discount: discountAmount,
      applied_coupon: appliedCoupon,
      loyalty_discount: loyaltyDiscount,
      loyalty_points_used: loyaltyPointsUsed,
      total_amount: totalAmount,
      points_earned: pointsEarned
    };
  }
}

module.exports = new PricingService();
