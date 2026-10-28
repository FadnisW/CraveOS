import type { CartItemOption, MenuItem } from '../types';

/**
 * Client-side display pricing for a configured menu item.
 *
 * The server quote is authoritative; this file only keeps the cart and item
 * modal from showing a number the server will disagree with. The rule is:
 *
 *  - A selected size replaces the item's base price.
 *  - The member price keeps the item's fixed rupee discount
 *    (base MRP - base member price), floored at zero.
 *  - Add-ons add their price to both MRP and member price.
 */
export function selectedVariant(options: CartItemOption[] = []) {
  return options.find((option) => option.groupId === 'variant');
}

function addOnTotal(options: CartItemOption[] = []) {
  return options
    .filter((option) => option.groupId !== 'variant')
    .reduce((sum, option) => sum + option.price, 0);
}

function baseMrp(item: MenuItem, options: CartItemOption[] = []) {
  const variant = selectedVariant(options);
  return variant ? variant.price : item.mrp;
}

/** What a non-member pays for one unit, including extras. */
export function unitMrpFor(
  item: MenuItem,
  options: CartItemOption[] = [],
): number {
  return baseMrp(item, options) + addOnTotal(options);
}

/** What a member pays for one unit, including extras. */
export function unitMemberPriceFor(
  item: MenuItem,
  options: CartItemOption[] = [],
): number {
  const base = baseMrp(item, options);
  const fixedDiscount = Math.max(0, item.mrp - item.memberPrice);
  const memberBase = Math.max(0, base - fixedDiscount);
  return Math.min(base + addOnTotal(options), memberBase + addOnTotal(options));
}

/**
 * The exact payload the quote and order endpoints accept. Prices are never
 * sent: the server looks every option up in the live catalogue row.
 */
export function optionsPayload(options: CartItemOption[] = []) {
  return options.map((option) => ({
    groupId: option.groupId,
    optionName: option.optionName,
  }));
}
