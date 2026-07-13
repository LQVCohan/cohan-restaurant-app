const DISH_ROWS = String.raw`
MON-PHO-001|breakfast|Món sáng|Phở bò đặc biệt|Bánh phở tươi, bò tái, nạm và nước dùng hầm xương trong, thơm gừng hành.|kitchen|12|NON_VEGETARIAN|BEEF|Đặc trưng,Bán chạy|||/images/menu/category-breakfast.svg|portion:regular:Phần tiêu chuẩn:79000:1:phoNoodle=180:g:0,beef=120:g:5,beefBone=90:g:0,onion=20:g:0,scallion=8:g:0,cilantro=5:g:0,ginger=5:g:0,fishSauce=8:ml:0
BUN-BO-HUE|breakfast|Món sáng|Bún bò Huế|Bún sợi lớn dùng cùng thịt bò, thịt heo và nước dùng sả ớt đậm vị miền Trung.|kitchen|14|NON_VEGETARIAN|BEEF,PORK|Đậm vị|||/images/menu/category-breakfast.svg|portion:regular:Phần tiêu chuẩn:72000:1:hueNoodle=180:g:0,beef=80:g:5,pork=70:g:5,lemongrass=18:g:0,chili=5:g:0,scallion=8:g:0,fishSauce=10:ml:0
BANH-MI-OP-LA|breakfast|Món sáng|Bánh mì ốp la chả lụa|Bánh mì nóng giòn dùng cùng trứng ốp la, chả lụa, dưa leo và nước sốt nhà làm.|kitchen|10|NON_VEGETARIAN|PORK|Phục vụ nhanh||egg,gluten|/images/menu/category-breakfast.svg|portion:regular:Phần tiêu chuẩn:49000:1:bread=1:piece:0,egg=2:piece:0,porkRoll=50:g:0,cucumber=40:g:0,cilantro=5:g:0,chiliSauce=12:ml:0
BANH-CUON-CHA-LUA|breakfast|Món sáng|Bánh cuốn chả lụa|Bánh cuốn mềm, nhân thịt xào, chả lụa và nước mắm chua ngọt pha trong ngày.|kitchen|12|NON_VEGETARIAN|PORK|Món Việt|||/images/menu/category-breakfast.svg|portion:regular:Phần tiêu chuẩn:58000:1:riceSheet=180:g:0,pork=70:g:5,porkRoll=60:g:0,onion=20:g:0,fishSauce=20:ml:0,sugar=8:g:0,chili=2:g:0
CHAO-SUON-TRUNG|breakfast|Món sáng|Cháo sườn trứng|Cháo gạo nấu nhuyễn cùng sườn non mềm, trứng gà, hành lá và tiêu xay.|kitchen|15|NON_VEGETARIAN|PORK|Ấm bụng||egg|/images/menu/category-breakfast.svg|portion:regular:Phần tiêu chuẩn:62000:1:porridgeRice=100:g:0,porkRib=120:g:8,egg=1:piece:0,scallion=8:g:0,pepper=1:g:0,fishSauce=6:ml:0
CA-PHE-SUA-DA|breakfast|Đồ uống|Cà phê sữa đá|Cà phê rang xay pha phin, kết hợp sữa đặc và đá lạnh theo phong cách Việt Nam.|bar|7|VEGETARIAN||Cà phê Việt||milk|/images/menu/category-drink.svg|portion:regular:Ly tiêu chuẩn:32000:1:coffee=22:g:0,condensedMilk=35:ml:0
TRA-TAC|breakfast|Đồ uống|Trà tắc|Trà đen ủ thơm, tắc tươi và vị chua ngọt cân bằng, phục vụ lạnh.|bar|6|VEGAN||Thanh mát|vegan||/images/menu/category-drink.svg|portion:regular:Ly tiêu chuẩn:30000:1:blackTea=12:g:0,kumquat=4:piece:0,sugar=25:g:0
COM-GA-XOI-MO|lunch|Cơm và món Việt|Cơm gà xối mỡ|Đùi gà chiên da giòn, thịt mềm, dùng cùng cơm thơm, dưa leo và nước mắm tỏi.|kitchen|18|NON_VEGETARIAN|CHICKEN|Bán chạy|||/images/menu/category-vietnamese.svg|portion:regular:Phần tiêu chuẩn:78000:1:rice=180:g:0,chickenThigh=250:g:8,cucumber=50:g:0,cilantro=5:g:0,cookingOil=35:ml:0,fishSauce=15:ml:0,garlic=5:g:0
COM-SUON-NUONG|lunch|Cơm và món Việt|Cơm sườn nướng mật ong|Sườn non ướp mật ong và gia vị, nướng thơm, dùng cùng cơm trắng và rau ăn kèm.|kitchen|20|NON_VEGETARIAN|PORK|Món nướng|||/images/menu/category-vietnamese.svg|portion:regular:Phần tiêu chuẩn:82000:1:rice=180:g:0,porkRib=220:g:8,honey=15:ml:0,fishSauce=10:ml:0,garlic=6:g:0,cucumber=50:g:0
CA-LOC-KHO-TO|lunch|Cơm và món Việt|Cá lóc kho tộ|Cá lóc kho lửa nhỏ với nước mắm, nước dừa và tiêu, vị mặn ngọt hài hòa.|kitchen|24|NON_VEGETARIAN|FISH|Món nhà|||/images/menu/category-vietnamese.svg|portion:regular:Phần tiêu chuẩn:98000:1:snakeheadFish=250:g:8,coconutWater=80:ml:0,fishSauce=18:ml:0,sugar=10:g:0,pepper=2:g:0,scallion=8:g:0
CANH-CHUA-CA-LOC|lunch|Cơm và món Việt|Canh chua cá lóc|Canh chua nấu cá lóc, cà chua, thơm, bạc hà và rau thơm, vị chua thanh dễ dùng.|kitchen|20|NON_VEGETARIAN|FISH|Dùng chung|||/images/menu/category-vietnamese.svg|portion:regular:Tô dùng chung:120000:1:snakeheadFish=300:g:8,tomato=120:g:0,pineapple=100:g:0,taroStem=100:g:0,herbs=20:g:0,tamarind=25:g:0,fishSauce=12:ml:0,sugar=10:g:0
THIT-KHO-TRUNG|lunch|Cơm và món Việt|Thịt kho trứng nước dừa|Thịt heo kho mềm cùng trứng gà và nước dừa tươi, màu nâu trong, vị đậm vừa.|kitchen|22|NON_VEGETARIAN|PORK|Món nhà||egg|/images/menu/category-vietnamese.svg|portion:regular:Phần tiêu chuẩn:95000:1:pork=250:g:8,egg=2:piece:0,coconutWater=120:ml:0,fishSauce=18:ml:0,sugar=12:g:0,pepper=1:g:0
RAU-MUONG-XAO-TOI|lunch|Rau và món phụ|Rau muống xào tỏi|Rau muống xanh giòn xào nhanh với tỏi phi, nêm vừa vị và phục vụ nóng.|kitchen|10|VEGAN||Món chay|vegan||/images/menu/category-vegetable.svg|portion:regular:Phần tiêu chuẩn:65000:1:waterSpinach=300:g:8,garlic=18:g:0,cookingOil=20:ml:0,salt=3:g:0
TOM-SU-RANG-ME-PHAN|lunch|Hải sản|Tôm sú rang me|Tôm sú rang cùng sốt me chua ngọt, tỏi phi và ớt tươi, sốt bám đều từng con.|kitchen|18|NON_VEGETARIAN|SEAFOOD|Hải sản||seafood|/images/menu/category-seafood.svg|portion:regular:Phần tiêu chuẩn:185000:1:tigerPrawn=350:g:10,tamarind=35:g:0,sugar=18:g:0,garlic=10:g:0,chili=3:g:0,fishSauce=8:ml:0
BO-LUC-LAC|lunch|Cơm và món Việt|Bò lúc lắc|Thịt bò cắt khối áp chảo nhanh cùng hành tây và ớt chuông, giữ độ mềm mọng.|kitchen|16|NON_VEGETARIAN|BEEF|Áp chảo|keto||/images/menu/category-vietnamese.svg|portion:regular:Phần tiêu chuẩn:168000:1:beef=250:g:8,onion=80:g:0,bellPepper=80:g:0,garlic=8:g:0,oysterSauce=15:ml:0,pepper=2:g:0
NUOC-CAM-TUOI|lunch|Đồ uống|Nước cam tươi|Cam tươi vắt nguyên chất, vị chua ngọt tự nhiên, có thể điều chỉnh lượng đường.|bar|6|VEGAN||Nước ép|vegan||/images/menu/category-drink.svg|portion:regular:Ly tiêu chuẩn:42000:1:orange=3:piece:0,sugar=10:g:0
CHANH-DAY-SODA|lunch|Đồ uống|Chanh dây soda|Chanh dây tươi kết hợp soda lạnh, vị chua thơm và sủi nhẹ.|bar|6|VEGAN||Soda trái cây|vegan||/images/menu/category-drink.svg|portion:regular:Ly tiêu chuẩn:45000:1:passionFruit=2:piece:0,sodaWater=250:ml:0,sugar=20:g:0
GOI-NGO-SEN-TOM-THIT|dinner|Khai vị và gỏi|Gỏi ngó sen tôm thịt|Ngó sen giòn trộn tôm sú, thịt heo, rau thơm và nước mắm chua ngọt.|kitchen|18|NON_VEGETARIAN|PORK,SEAFOOD|Khai vị||seafood|/images/menu/category-starter.svg|portion:regular:Phần tiêu chuẩn:145000:1:lotusStem=200:g:0,tigerPrawn=180:g:10,pork=120:g:6,carrot=60:g:0,herbs=20:g:0,fishSauce=22:ml:0,sugar=16:g:0,vinegar=12:ml:0
CA-DUC-NUONG-MUOI-OT|dinner|Hải sản|Cá đục nướng muối ớt|Cá đục tươi ướp muối ớt, nướng lửa vừa để da thơm và thịt giữ độ ngọt tự nhiên.|kitchen|24|NON_VEGETARIAN|FISH|Hải sản tươi,Món nướng|keto||/images/menu/category-seafood.svg|portion:portion:Phần tiêu chuẩn:150000:1:silverSillago=350:g:10,salt=4:g:0,chili=8:g:0,garlic=8:g:0,cookingOil=10:ml:0;kg:by_kg:Theo kilogram:400000:0:silverSillago=1000:g:10,salt=10:g:0,chili=20:g:0,garlic=20:g:0,cookingOil=25:ml:0
CA-MU-HAP-HONG-KONG|dinner|Hải sản|Cá mú hấp Hồng Kông|Cá mú tươi hấp cùng gừng, hành lá và nước tương, thịt cá chắc ngọt, sốt thanh nhẹ.|kitchen|30|NON_VEGETARIAN|FISH|Tính theo kg,Hải sản tươi|keto||/images/menu/category-seafood.svg|kg:by_kg:Theo kilogram:720000:1:grouper=1000:g:12,ginger=30:g:0,scallion=35:g:0,soySauce=45:ml:0,cookingOil=20:ml:0
CA-CHEM-HAP-XI-DAU|dinner|Hải sản|Cá chẽm hấp xì dầu|Cá chẽm hấp nguyên vị cùng gừng, hành và xì dầu, phù hợp dùng chung trong bữa tối.|kitchen|28|NON_VEGETARIAN|FISH|Hải sản tươi|keto||/images/menu/category-seafood.svg|portion:portion:Phần khoảng 600 g:280000:1:seabass=600:g:10,ginger=18:g:0,scallion=22:g:0,soySauce=28:ml:0;kg:by_kg:Theo kilogram:460000:0:seabass=1000:g:10,ginger=30:g:0,scallion=35:g:0,soySauce=45:ml:0
MUC-LA-NUONG-SA-TE|dinner|Hải sản|Mực lá nướng sa tế|Mực lá tươi ướp sa tế và sả, nướng nhanh để giữ độ giòn ngọt và mùi thơm đặc trưng.|kitchen|22|NON_VEGETARIAN|SEAFOOD|Món nướng,Hải sản tươi|keto|seafood|/images/menu/category-seafood.svg|portion:portion:Phần tiêu chuẩn:235000:1:squid=450:g:12,satay=22:g:0,lemongrass=18:g:0,garlic=10:g:0,cookingOil=12:ml:0;kg:by_kg:Theo kilogram:520000:0:squid=1000:g:12,satay=48:g:0,lemongrass=40:g:0,garlic=22:g:0,cookingOil=26:ml:0
TOM-SU-RANG-MUOI|dinner|Hải sản|Tôm sú rang muối|Tôm sú rang khô cùng muối tiêu, tỏi và ớt, vỏ giòn nhẹ, thịt tôm chắc ngọt.|kitchen|20|NON_VEGETARIAN|SEAFOOD|Hải sản tươi|keto|seafood|/images/menu/category-seafood.svg|portion:portion:Phần 500 g:265000:1:tigerPrawn=500:g:10,salt=6:g:0,pepper=3:g:0,garlic=12:g:0,chili=4:g:0;kg:by_kg:Theo kilogram:560000:0:tigerPrawn=1000:g:10,salt=12:g:0,pepper=6:g:0,garlic=24:g:0,chili=8:g:0
CUA-CA-MAU-SOT-ME|dinner|Hải sản|Cua Cà Mau sốt me|Cua Cà Mau chắc thịt, chế biến với sốt me chua ngọt, tỏi phi và ớt tươi.|kitchen|32|NON_VEGETARIAN|SEAFOOD|Tính theo kg,Hải sản tươi||seafood|/images/menu/category-seafood.svg|kg:by_kg:Theo kilogram:860000:1:crab=1000:g:18,tamarind=80:g:0,sugar=35:g:0,garlic=25:g:0,chili=8:g:0,fishSauce=18:ml:0
NGHEU-HAP-SA|dinner|Hải sản|Nghêu hấp sả|Nghêu tươi hấp cùng sả, gừng và ớt, nước hấp ngọt thanh tự nhiên.|kitchen|16|NON_VEGETARIAN|SEAFOOD|Dùng chung||seafood|/images/menu/category-seafood.svg|portion:regular:Nồi dùng chung:125000:1:clam=700:g:12,lemongrass=35:g:0,ginger=15:g:0,chili=4:g:0,fishSauce=8:ml:0
MON-BO-002|dinner|Món nướng|Bò nướng sốt tiêu đen|Thăn bò nướng vừa chín, phủ sốt tiêu đen, dùng kèm rau củ theo mùa.|kitchen|18|NON_VEGETARIAN|BEEF|Bán chạy,Món nướng|||/images/menu/category-grill.svg|portion:regular:Phần tiêu chuẩn:179000:1:beef=260:g:8,pepper=3:g:0,oysterSauce=18:ml:0,onion=70:g:0,bellPepper=70:g:0,butter=10:g:0
GA-NUONG-MAT-ONG|dinner|Món nướng|Gà nướng mật ong|Gà ta ướp mật ong, tỏi và gia vị, nướng da vàng thơm, thịt chín mọng.|kitchen|35|NON_VEGETARIAN|CHICKEN|Món dùng chung|||/images/menu/category-grill.svg|portion:half:Nửa con:245000:1:chicken=900:g:12,honey=35:ml:0,garlic=18:g:0,fishSauce=16:ml:0,pepper=2:g:0;portion:whole:Nguyên con:445000:0:chicken=1800:g:12,honey=70:ml:0,garlic=36:g:0,fishSauce=32:ml:0,pepper=4:g:0
LAU-GA-LA-E|dinner|Lẩu|Lẩu gà lá é|Gà ta nấu cùng nấm và lá é, nước dùng thơm cay nhẹ, dùng kèm rau và bún.|kitchen|28|NON_VEGETARIAN|CHICKEN|Lẩu đặc trưng|||/images/menu/category-hotpot.svg|portion:regular:Nồi 3–4 người:385000:1:chicken=1200:g:12,mushroom=250:g:0,laELeaf=120:g:0,lemongrass=30:g:0,chili=8:g:0,fishSauce=25:ml:0
LAU-HAI-SAN-CHUA-CAY|dinner|Lẩu|Lẩu hải sản chua cay|Nồi lẩu chua cay với tôm sú, mực, nghêu, nấm và rau theo mùa.|kitchen|30|NON_VEGETARIAN|SEAFOOD|Dùng chung,Hải sản||seafood|/images/menu/category-hotpot.svg|portion:regular:Nồi 3–4 người:495000:1:tigerPrawn=350:g:10,squid=350:g:12,clam=500:g:12,mushroom=220:g:0,tomato=150:g:0,pineapple=120:g:0,tamarind=30:g:0,lemongrass=35:g:0
COM-CHIEN-HAI-SAN|dinner|Cơm và món Việt|Cơm chiên hải sản|Cơm rang tơi cùng tôm, mực, trứng và rau củ, phục vụ nóng.|kitchen|16|NON_VEGETARIAN|SEAFOOD|Món dùng chung||seafood,egg|/images/menu/category-vietnamese.svg|portion:regular:Phần tiêu chuẩn:135000:1:rice=250:g:0,tigerPrawn=100:g:10,squid=100:g:12,egg=1:piece:0,carrot=50:g:0,scallion=8:g:0,soySauce=12:ml:0,cookingOil=20:ml:0
MI-XAO-BO|late_night|Món ăn khuya|Mì xào bò|Mì trứng xào bò, rau củ và sốt dầu hào, thích hợp cho bữa tối muộn.|kitchen|15|NON_VEGETARIAN|BEEF|Phục vụ nhanh|||/images/menu/category-late-night.svg|portion:regular:Phần tiêu chuẩn:99000:1:eggNoodle=180:g:0,beef=120:g:6,onion=50:g:0,bellPepper=50:g:0,oysterSauce=15:ml:0,cookingOil=15:ml:0
CHAO-HAI-SAN|late_night|Món ăn khuya|Cháo hải sản|Cháo gạo nấu cùng tôm, mực, gừng và hành lá, vị thanh, phục vụ nóng.|kitchen|18|NON_VEGETARIAN|SEAFOOD|Ấm bụng||seafood|/images/menu/category-late-night.svg|portion:regular:Phần tiêu chuẩn:105000:1:porridgeRice=110:g:0,tigerPrawn=100:g:10,squid=90:g:12,ginger=8:g:0,scallion=8:g:0,fishSauce=8:ml:0
SUP-BIDO-001|late_night|Món ăn khuya|Súp bí đỏ kem tươi|Bí đỏ Đà Lạt xay mịn cùng kem tươi, bơ lạt và bánh mì nướng giòn.|kitchen|10|VEGETARIAN||Món nhẹ||milk,gluten|/images/menu/category-late-night.svg|portion:regular:Tô tiêu chuẩn:59000:1:pumpkin=280:g:0,cream=40:ml:0,butter=8:g:0,bread=0.5:piece:0
KHOAI-TAY-CHIEN|late_night|Rau và món phụ|Khoai tây chiên|Khoai tây cắt thanh chiên giòn, dùng cùng tương ớt và sốt nhà làm.|kitchen|12|VEGAN||Món ăn nhẹ|vegan||/images/menu/category-vegetable.svg|portion:regular:Phần tiêu chuẩn:65000:1:potato=350:g:10,cookingOil=80:ml:0,salt=3:g:0,chiliSauce=20:ml:0
DUA-HAU-LANH|late_night|Tráng miệng|Dưa hấu lạnh|Dưa hấu tuyển chọn cắt miếng vừa ăn, làm lạnh trước khi phục vụ.|kitchen|5|VEGAN||Tráng miệng|vegan||/images/menu/category-dessert.svg|portion:regular:Đĩa dùng chung:49000:1:watermelon=500:g:12
NUOC-TRA-001|late_night|Đồ uống|Trà đào cam sả|Trà đen ủ lạnh, đào miếng, cam tươi và sả, vị thanh mát dễ uống.|bar|6|VEGAN||Bán chạy|vegan||/images/menu/category-drink.svg|portion:regular:Ly tiêu chuẩn:49000:1:blackTea=12:g:0,peach=80:g:0,orange=0.5:piece:0,lemongrass=8:g:0,sugar=25:g:0
`.trim();

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function parseRecipeLine(value) {
  const [ingredient, qty, unit, wastePct = "0"] = value.split(/[:=]/);
  return {
    ingredient,
    qty: Number(qty),
    unit,
    wastePct: Number(wastePct),
  };
}

function parseVariant(value) {
  const [mode, key, name, price, isDefault, ...recipeParts] = value.split(":");
  const recipe = recipeParts.join(":");
  return {
    key,
    name,
    mode: mode === "kg" ? "BY_WEIGHT" : "PORTION",
    sellQty: 1,
    sellUnit: mode === "kg" ? "kg" : "portion",
    price: Number(price),
    isDefault: isDefault === "1",
    ingredients: splitList(recipe).map(parseRecipeLine),
  };
}

export const DISH_DEFS = DISH_ROWS.split("\n").map((row) => {
  const [
    code,
    timeSlot,
    category,
    name,
    description,
    prepStation,
    avgPrepTimeMin,
    foodType,
    meatTypes,
    labels,
    dietTags,
    allergenTags,
    thumbImage,
    variants,
  ] = row.split("|");
  return {
    code,
    timeSlot,
    category,
    name,
    description,
    prepStation,
    avgPrepTimeMin: Number(avgPrepTimeMin),
    foodType,
    meatTypes: splitList(meatTypes),
    labels: splitList(labels),
    dietTags: splitList(dietTags),
    allergenTags: splitList(allergenTags),
    thumbImage,
    status: "available",
    variants: String(variants || "")
      .split(";")
      .filter(Boolean)
      .map(parseVariant),
  };
});
