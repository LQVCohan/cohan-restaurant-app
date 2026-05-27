import { describe, it, expect } from 'vitest';
import { __testables } from '../../src/services/ai/restaurantChatbot.service.js';

const { extractMenuPreferences, rankMenuRecommendations, menuFallback, fallbackActions } = __testables;

describe('restaurantChatbot menu assistant', () => {
  it('extract budget and party size', () => {
    const p = extractMenuPreferences('gợi ý món cho 2 người dưới 100k, không cay');
    expect(p.budgetMax).toBe(100000);
    expect(p.partySize).toBe(2);
    expect(p.taste).toContain('nonSpicy');
  });

  it('rank budget menu', () => {
    const items = [
      { id:'1', name:'A', basePrice:80000, currentPrice:80000, status:'available', isAvailable:true },
      { id:'2', name:'B', basePrice:150000, currentPrice:150000, status:'available', isAvailable:true },
      { id:'3', name:'C', basePrice:90000, currentPrice:90000, status:'unavailable', isAvailable:false },
    ];
    const ranked = rankMenuRecommendations(items, { budgetMax: 100000, intentSubtype:['budget'] }, 3);
    expect(ranked[0].id).toBe('1');
    expect(ranked[2].id).toBe('3');
  });

  it('vegetarian preference', () => {
    const ranked = rankMenuRecommendations([
      { id:'v', name:'Rau xào chay', labels:['chay'], status:'available', isAvailable:true },
      { id:'m', name:'Bò lúc lắc', labels:['beef'], status:'available', isAvailable:true },
    ], { dietary:['vegetarian'], intentSubtype:['vegetarian'] }, 2);
    expect(ranked[0].id).toBe('v');
  });

  it('menuFallback uses recommended first and actions has food detail', () => {
    const context = { intent:'menu', restaurants:[{id:'r1'}], recommendedMenuItems:[{id:'f1', name:'Phở', formattedPrice:'90.000đ'}], menuItems:[{id:'f2', name:'Bún', formattedPrice:'80.000đ'}] };
    expect(menuFallback(context)).toContain('Phở');
    expect(fallbackActions(context).some((a) => a.href === '/food/f1')).toBe(true);
  });
});
