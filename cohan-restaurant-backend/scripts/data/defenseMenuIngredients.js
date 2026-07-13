export const PRICE_REFERENCE_NOTE =
  "Giá nhập tham chiếu nhà cung cấp thực phẩm tại TP.HCM, cập nhật 07/2026; cần đối soát báo giá khi vận hành thực tế.";

const INGREDIENT_ROWS = String.raw`
beef|Thịt bò|g|235|4000|24000
beefBone|Xương bò|g|42|6000|38000
pork|Thịt heo|g|118|5000|30000
porkRib|Sườn non heo|g|155|3500|24000
porkRoll|Chả lụa|g|145|1800|11000
chicken|Gà ta làm sạch|g|82|6000|40000
chickenThigh|Đùi gà|g|98|3500|24000
chickenWing|Cánh gà|g|105|3000|20000
snakeheadFish|Cá lóc|g|120|4000|28000
silverSillago|Cá đục|g|145|3500|24000
grouper|Cá mú|g|360|3500|20000
seabass|Cá chẽm|g|195|3500|24000
squid|Mực lá|g|245|3000|20000
tigerPrawn|Tôm sú|g|310|3500|24000
crab|Cua Cà Mau|g|480|3000|18000
clam|Nghêu|g|78|4500|32000
phoNoodle|Bánh phở tươi|g|28|6000|38000
hueNoodle|Bún bò sợi lớn|g|26|6000|36000
bread|Bánh mì|piece|7500|50|300
riceSheet|Bánh cuốn|g|35|3500|22000
rice|Gạo thơm|g|30|12000|80000
eggNoodle|Mì trứng|g|42|4500|30000
porridgeRice|Gạo nấu cháo|g|30|6000|36000
potato|Khoai tây|g|40|6000|34000
beanSprout|Giá đỗ|g|28|1800|12000
scallion|Hành lá|g|70|900|6500
onion|Hành tây|g|34|2500|17000
cilantro|Ngò rí|g|90|800|5500
herbs|Rau thơm hỗn hợp|g|95|1200|8500
tomato|Cà chua|g|42|3000|20000
pineapple|Thơm|g|38|2500|17000
taroStem|Bạc hà|g|45|1500|10000
waterSpinach|Rau muống|g|34|3000|20000
garlic|Tỏi|g|95|1800|13000
ginger|Gừng|g|65|1500|10000
lemongrass|Sả|g|52|2200|15000
chili|Ớt tươi|g|110|900|6000
laELeaf|Lá é|g|105|1100|7500
mushroom|Nấm tươi|g|85|2200|15000
lotusStem|Ngó sen|g|70|1800|13000
lettuce|Xà lách|g|52|1800|12000
cucumber|Dưa leo|g|35|2200|15000
carrot|Cà rốt|g|38|2200|15000
bellPepper|Ớt chuông|g|90|1500|10000
watermelon|Dưa hấu|g|28|6000|38000
pumpkin|Bí đỏ Đà Lạt|g|38|3500|24000
peach|Đào ngâm|g|75|1800|12000
egg|Trứng gà|piece|4500|72|480
fishSauce|Nước mắm|ml|45|3500|24000
soySauce|Nước tương|ml|40|3000|20000
oysterSauce|Dầu hào|ml|65|2500|18000
chiliSauce|Tương ớt|ml|42|2500|18000
sugar|Đường|g|24|6000|42000
salt|Muối|g|10|3500|24000
pepper|Tiêu|g|190|900|6000
tamarind|Me|g|70|1800|13000
honey|Mật ong|ml|155|1500|10000
satay|Sa tế|g|105|1500|10000
cookingOil|Dầu ăn|ml|48|7000|46000
coconutWater|Nước dừa tươi|ml|32|4000|26000
vinegar|Giấm gạo|ml|28|1800|13000
coffee|Cà phê rang xay|g|210|1800|13000
condensedMilk|Sữa đặc|ml|80|2600|18000
blackTea|Trà đen|g|155|1200|8500
kumquat|Tắc|piece|2000|100|650
orange|Cam tươi|piece|8000|60|380
passionFruit|Chanh dây|piece|5500|55|340
lime|Chanh tươi|piece|4000|90|560
sodaWater|Soda|ml|24|6000|40000
cream|Kem tươi|ml|120|1500|10000
butter|Bơ lạt|g|180|1000|7000
`.trim();

export const INGREDIENT_DEFS = INGREDIENT_ROWS.split("\n").map((row) => {
  const [key, name, baseUnit, costPerBaseUnit, minStock, onHand] = row.split("|");
  return {
    key,
    name,
    baseUnit,
    costPerBaseUnit: Number(costPerBaseUnit),
    minStock: Number(minStock),
    onHand: Number(onHand),
  };
});
