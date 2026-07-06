import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import process from "node:process";
import { Ingredient, MenuItem, Recipe, Restaurant } from "../models/index.js";
import { safeDbInfo } from "./lib/scriptSafety.js";

const EXPECTED_BRAND_ID = "6a447f6bea9844b4c8544c49";
const TARGET_RESTAURANTS = [
  {
    id: "69ce9e2e8d8d711f12e251b1",
    expectedName: "Cohan Restaurant",
  },
  {
    id: "6a447f6bea9844b4c8544c4f",
    expectedName: "Cohan Restaurant 2",
  },
];

const guide = ({ preparation, cooking, finishing, quality, service }) =>
  [
    `Sơ chế: ${preparation}`,
    `Chế biến: ${cooking}`,
    `Hoàn thiện: ${finishing}`,
    `Tiêu chuẩn thành phẩm: ${quality}`,
    `Phục vụ và bảo quản: ${service}`,
  ].join("\n");

const RECIPE_GUIDES = new Map([
  [
    "Phở bò tái",
    guide({
      preparation:
        "Trụng bánh phở cho tơi; thái thịt bò mỏng ngang thớ; rửa và cắt hành lá, ngò rí; gừng nướng đập dập. Nước dùng xương bò phải được hớt bọt và lọc trong.",
      cooking:
        "Đun nước dùng sôi nhẹ, nêm nước mắm vừa vị. Trụng bánh phở nhanh, xếp thịt bò tái lên mặt rồi chan nước dùng thật nóng để thịt vừa chín tới.",
      finishing:
        "Thêm hành lá, ngò rí, hành tây và một ít tiêu; lau sạch miệng tô trước khi giao món.",
      quality:
        "Nước dùng trong, thơm gừng hành; bánh phở mềm nhưng không nát; thịt bò mềm, không dai và không chín khô.",
      service:
        "Phục vụ ngay khi còn nóng. Không giữ bánh phở đã trụng hoặc thịt bò đã chan nước dùng để dùng lại.",
    }),
  ],
  [
    "Bún bò Huế",
    guide({
      preparation:
        "Trụng bún sợi lớn; thái thịt bò và thịt heo vừa ăn; đập dập sả, cắt hành lá và chuẩn bị ớt. Nước dùng phải được lọc sạch cặn.",
      cooking:
        "Đun nước dùng với sả ở mức sôi nhẹ, nêm nước mắm và ớt cân bằng. Trụng nóng thịt, cho bún vào tô rồi chan nước dùng ngập mặt.",
      finishing:
        "Xếp thịt đều, thêm hành lá và rau thơm; kiểm tra độ cay trước khi giao món.",
      quality:
        "Nước dùng thơm sả, đậm nhưng không gắt; bún không bở; thịt mềm và nóng đều.",
      service:
        "Phục vụ nóng ngay sau khi chan. Rau ăn kèm để riêng, giữ mát và sạch.",
    }),
  ],
  [
    "Bánh mì ốp la chả lụa",
    guide({
      preparation:
        "Làm nóng bánh mì; thái chả lụa, dưa leo và nhặt rau thơm. Trứng được kiểm tra vỏ sạch trước khi sử dụng.",
      cooking:
        "Chiên trứng với lượng dầu vừa đủ đến khi lòng trắng chín hoàn toàn, lòng đỏ đạt độ chín theo tiêu chuẩn nhà hàng. Làm nóng chả lụa nhẹ nếu cần.",
      finishing:
        "Xếp trứng, chả lụa, dưa leo và rau thơm vào đĩa hoặc bánh; thêm sốt và tương ớt đúng định lượng.",
      quality:
        "Bánh mì nóng giòn, trứng không cháy cạnh, chả lụa không khô, rau giữ độ tươi.",
      service:
        "Phục vụ ngay sau khi hoàn thiện; không giữ trứng đã chiên ở nhiệt độ phòng lâu.",
    }),
  ],
  [
    "Bánh cuốn chả lụa",
    guide({
      preparation:
        "Làm nóng bánh cuốn bằng hơi nước; xào chín phần thịt và hành dùng kèm; thái chả lụa, chuẩn bị rau thơm và nước mắm chua ngọt.",
      cooking:
        "Hấp bánh cuốn đến khi mềm nóng nhưng không nhão. Phần nhân phải chín kỹ, tơi và không còn nước.",
      finishing:
        "Xếp bánh cuốn, chả lụa và rau thơm gọn trên đĩa; nước mắm để chén riêng và thêm ớt theo yêu cầu.",
      quality:
        "Bánh mềm, không dính bết; nhân thơm, chả lụa cắt đều; nước mắm có vị mặn, chua và ngọt cân bằng.",
      service:
        "Phục vụ nóng. Bánh đã hấp chỉ sử dụng trong ca và không hấp đi hấp lại nhiều lần.",
    }),
  ],
  [
    "Cháo sườn trứng",
    guide({
      preparation:
        "Vo gạo nấu cháo, chần sườn non và rửa sạch; cắt hành lá, chuẩn bị tiêu và trứng gà.",
      cooking:
        "Ninh gạo đến khi nhuyễn, cho sườn vào nấu mềm và nêm nước mắm vừa vị. Cho trứng vào cuối quá trình, bảo đảm trứng chín theo tiêu chuẩn phục vụ.",
      finishing:
        "Múc cháo và sườn đủ định lượng, rắc hành lá và tiêu; kiểm tra nhiệt độ trước khi giao món.",
      quality:
        "Cháo mịn, không khê; sườn mềm nhưng còn nguyên miếng; vị thanh, thơm tiêu và hành.",
      service:
        "Giữ nóng trong nồi chuyên dụng và khuấy định kỳ. Không pha thêm nước lã trực tiếp vào cháo thành phẩm.",
    }),
  ],
  [
    "Cà phê sữa đá",
    guide({
      preparation:
        "Tráng nóng phin và ly; cân cà phê rang xay, đong sữa đặc và chuẩn bị đá sạch.",
      cooking:
        "Ủ cà phê với một ít nước nóng, sau đó châm đủ lượng nước và để nhỏ giọt tự nhiên. Khuấy cà phê với sữa đặc cho đồng nhất.",
      finishing:
        "Cho đá vào ly, rót cà phê sữa lên trên và kiểm tra miệng ly sạch.",
      quality:
        "Cà phê thơm, vị đậm và hậu vị sạch; sữa hòa đều, không lắng thành mảng; đá không có mùi lạ.",
      service:
        "Phục vụ ngay sau khi pha. Cà phê đã pha không để qua ngày.",
    }),
  ],
  [
    "Trà tắc",
    guide({
      preparation:
        "Ủ trà đen đúng thời gian rồi lọc bã; rửa tắc, cắt đôi và loại hạt; chuẩn bị đường và đá sạch.",
      cooking:
        "Hòa đường vào trà khi còn ấm, để nguội rồi thêm nước tắc. Không đun trực tiếp nước tắc để tránh vị đắng.",
      finishing:
        "Lắc trà với đá, rót ra ly và thêm lát tắc trang trí.",
      quality:
        "Màu trà trong, thơm; vị chua ngọt cân bằng, không chát gắt và không đắng vỏ.",
      service:
        "Bảo quản nền trà trong bình kín, giữ mát và sử dụng trong ngày.",
    }),
  ],
  [
    "Cơm gà xối mỡ",
    guide({
      preparation:
        "Làm sạch đùi gà, để ráo và ướp gia vị; nấu cơm thơm; cắt dưa leo và chuẩn bị nước mắm tỏi.",
      cooking:
        "Làm chín đùi gà trước, sau đó xối hoặc chiên dầu nóng đến khi da vàng giòn và phần thịt chín hoàn toàn. Để ráo dầu trước khi cắt.",
      finishing:
        "Xới cơm đủ định lượng, đặt đùi gà bên cạnh, thêm dưa leo và chén nước mắm tỏi.",
      quality:
        "Da gà giòn, thịt mềm mọng và không còn phần sống; cơm tơi, nóng, không khô.",
      service:
        "Phục vụ ngay sau khi chiên. Không chiên lại phần gà đã để nguội lâu.",
    }),
  ],
  [
    "Cơm sườn nướng mật ong",
    guide({
      preparation:
        "Sơ chế sườn non, thấm khô và ướp mật ong, tỏi, nước mắm cùng gia vị; nấu cơm và chuẩn bị rau ăn kèm.",
      cooking:
        "Nướng sườn ở lửa vừa, trở đều và quét lớp sốt mỏng trong quá trình nướng đến khi thịt chín, bề mặt vàng bóng nhưng không cháy đường.",
      finishing:
        "Cắt sườn vừa ăn, xếp cùng cơm nóng và rau; rưới lượng sốt còn lại đã được đun chín.",
      quality:
        "Sườn mềm, thơm mật ong, bề mặt vàng nâu; không cháy đen và không còn phần thịt sống sát xương.",
      service:
        "Phục vụ nóng; sốt ướp đã tiếp xúc thịt sống phải được nấu chín trước khi dùng.",
    }),
  ],
  [
    "Cá lóc kho tộ",
    guide({
      preparation:
        "Làm sạch cá lóc, cắt khúc, để ráo và ướp nước mắm, tiêu, tỏi; chuẩn bị nước dừa và nồi kho.",
      cooking:
        "Thắng màu nhẹ, cho cá vào săn mặt rồi thêm nước dừa. Kho lửa nhỏ đến khi cá chín, nước kho sánh và thấm đều; hạn chế đảo mạnh làm vỡ cá.",
      finishing:
        "Nêm lại vị, rắc tiêu và hành lá; lau sạch thành nồi trước khi phục vụ.",
      quality:
        "Khúc cá nguyên, thịt chắc nhưng không khô; nước kho nâu trong, sánh vừa, vị mặn ngọt hài hòa.",
      service:
        "Giữ nóng và dùng trong ca. Khi hâm lại phải đun sôi đều, không hâm nhiều lần.",
    }),
  ],
  [
    "Canh chua cá lóc",
    guide({
      preparation:
        "Làm sạch cá lóc và cắt khúc; cắt cà chua, thơm, bạc hà; rửa rau thơm và chuẩn bị nước me.",
      cooking:
        "Nấu nước canh với me, thơm và cà chua; cho cá vào khi nước sôi nhẹ, hớt bọt và nấu chín. Thêm bạc hà ở cuối để giữ độ giòn.",
      finishing:
        "Nêm vị chua, ngọt và mặn cân bằng; thêm rau thơm và ớt tùy yêu cầu.",
      quality:
        "Nước canh trong, chua thanh; cá chín nguyên miếng, không tanh; rau củ còn màu và độ giòn.",
      service:
        "Phục vụ nóng. Không đun sôi kéo dài sau khi đã cho bạc hà và rau thơm.",
    }),
  ],
  [
    "Thịt kho trứng nước dừa",
    guide({
      preparation:
        "Cắt thịt heo đều miếng, chần sơ và để ráo; luộc trứng, bóc vỏ; chuẩn bị nước dừa, nước mắm và tiêu.",
      cooking:
        "Làm săn thịt với màu đường nhẹ, thêm nước dừa và kho lửa nhỏ đến khi thịt mềm. Cho trứng vào giai đoạn sau để thấm màu mà không bị chai.",
      finishing:
        "Nêm lại vị, hớt bớt mỡ nổi và xếp thịt trứng cân đối trong phần ăn.",
      quality:
        "Thịt mềm nhưng không nát, trứng nguyên, nước kho nâu trong và vị đậm vừa.",
      service:
        "Giữ nóng trong ca; làm nguội nhanh và bảo quản lạnh nếu lưu sang ca sau, chỉ hâm lại một lần.",
    }),
  ],
  [
    "Rau muống xào tỏi",
    guide({
      preparation:
        "Nhặt rau muống, rửa sạch và để thật ráo; đập dập tỏi, đong dầu và muối.",
      cooking:
        "Làm nóng chảo, phi thơm tỏi rồi cho rau vào xào nhanh trên lửa lớn. Nêm muối vừa vị và đảo đến khi rau vừa chín.",
      finishing:
        "Tắt bếp khi rau còn xanh giòn, xếp ra đĩa và rưới phần tỏi phi còn lại.",
      quality:
        "Rau xanh, giòn, không ra nhiều nước; tỏi vàng thơm nhưng không cháy.",
      service:
        "Phục vụ ngay sau khi xào; không giữ nóng lâu hoặc xào lại.",
    }),
  ],
  [
    "Tôm sú rang me",
    guide({
      preparation:
        "Rửa tôm sú, cắt râu, rút chỉ lưng và để ráo; pha sốt me với đường, nước mắm; băm tỏi và ớt.",
      cooking:
        "Áp chảo hoặc rang tôm đến khi chuyển màu và vừa chín. Phi tỏi, cho sốt me vào đun sánh rồi đảo tôm để sốt bám đều.",
      finishing:
        "Nêm lại vị, thêm ớt và rau thơm; không đun quá lâu làm tôm khô.",
      quality:
        "Tôm chắc ngọt, chín đều; sốt me bóng, chua ngọt cân bằng và không tách nước.",
      service:
        "Phục vụ nóng ngay sau khi rang. Tôm sống phải giữ lạnh đến lúc chế biến.",
    }),
  ],
  [
    "Bò lúc lắc",
    guide({
      preparation:
        "Cắt thịt bò thành khối đều, thấm khô và ướp nhẹ; cắt hành tây, ớt chuông; băm tỏi và chuẩn bị sốt dầu hào.",
      cooking:
        "Làm chảo thật nóng, áp chảo bò theo mẻ nhỏ để mặt thịt xém nhanh. Cho rau củ và sốt vào đảo ngắn đến khi bò đạt độ chín tiêu chuẩn.",
      finishing:
        "Rắc tiêu, đảo lần cuối rồi trút ngay ra đĩa; giữ rau củ còn độ giòn.",
      quality:
        "Thịt bò mềm mọng, mặt ngoài xém nhẹ; rau củ sáng màu, sốt bám mỏng và không ra nước.",
      service:
        "Phục vụ ngay; không giữ bò đã áp chảo trên bếp nóng quá lâu.",
    }),
  ],
  [
    "Nước cam tươi",
    guide({
      preparation:
        "Rửa cam, để ráo, cắt đôi; chuẩn bị dụng cụ vắt sạch, đường và đá.",
      cooking:
        "Vắt cam ngay trước khi phục vụ, lọc hạt và hòa đường theo mức khách chọn. Không ép mạnh phần vỏ trắng để tránh đắng.",
      finishing:
        "Rót vào ly có đá, thêm lát cam và kiểm tra miệng ly sạch.",
      quality:
        "Nước cam màu tự nhiên, thơm, không đắng và không có hạt; vị chua ngọt cân bằng.",
      service:
        "Phục vụ ngay sau khi vắt; không để nước cam đã vắt ở nhiệt độ phòng lâu.",
    }),
  ],
  [
    "Chanh dây soda",
    guide({
      preparation:
        "Rửa chanh dây, lấy ruột và lọc bớt hạt theo tiêu chuẩn; chuẩn bị nước đường, soda lạnh và đá sạch.",
      cooking:
        "Hòa chanh dây với nước đường, sau đó thêm soda từ từ để giữ ga. Không lắc mạnh sau khi đã cho soda.",
      finishing:
        "Rót vào ly đá, khuấy nhẹ và trang trí bằng lát trái cây phù hợp.",
      quality:
        "Mùi chanh dây rõ, vị chua ngọt cân bằng, soda còn độ sủi và không bị tách lớp quá nhiều.",
      service:
        "Phục vụ ngay sau khi thêm soda; nền chanh dây giữ lạnh và dùng trong ngày.",
    }),
  ],
  [
    "Gỏi ngó sen tôm thịt",
    guide({
      preparation:
        "Ngâm và rửa ngó sen cho sạch, để ráo; luộc chín tôm và thịt heo rồi làm nguội, thái vừa ăn; bào cà rốt, rửa rau thơm và pha nước trộn.",
      cooking:
        "Trộn ngó sen, cà rốt, tôm và thịt với nước mắm chua ngọt ngay trước khi phục vụ. Cho rau thơm vào cuối và đảo nhẹ.",
      finishing:
        "Để gỏi nghỉ ngắn cho thấm, chắt bớt nước rồi xếp cao gọn trên đĩa.",
      quality:
        "Ngó sen giòn, tôm thịt chín và không khô; vị chua ngọt mặn cân bằng, món không ra quá nhiều nước.",
      service:
        "Giữ lạnh nguyên liệu đã sơ chế; chỉ trộn theo từng đơn và không để gỏi đã trộn qua ca.",
    }),
  ],
  [
    "Cá đục nướng muối ớt",
    guide({
      preparation:
        "Làm sạch cá đục, bỏ mang và ruột, rửa nhanh rồi thấm khô; khứa nhẹ hai mặt. Giã muối, ớt và tỏi, trộn với dầu thành hỗn hợp ướp.",
      cooking:
        "Ướp cá đủ thời gian cho thấm, sau đó nướng lửa vừa. Trở cá nhẹ tay và quét lớp gia vị mỏng đến khi cá chín đều, da thơm và không cháy.",
      finishing:
        "Để cá nghỉ ngắn, xếp cùng rau thơm và dưa leo; nước chấm để riêng.",
      quality:
        "Da cá vàng thơm, thịt trắng chín và còn ẩm; vị mặn cay rõ nhưng không gắt, cá không có mùi tanh.",
      service:
        "Phục vụ ngay sau khi nướng. Cá sống giữ lạnh, không tái cấp đông sau khi đã rã đông.",
    }),
  ],
  [
    "Cá mú hấp Hồng Kông",
    guide({
      preparation:
        "Làm sạch cá mú, khứa nhẹ thân và thấm khô; thái sợi gừng, cắt hành lá; pha nước tương hấp.",
      cooking:
        "Đặt cá lên đĩa chịu nhiệt cùng gừng, hấp khi nước đã sôi đến khi phần thịt dày nhất chín. Đun nóng nước tương và dầu riêng.",
      finishing:
        "Chắt bỏ nước tanh trong đĩa, thêm hành gừng mới, rưới nước tương và dầu nóng lên cá.",
      quality:
        "Cá chín vừa, thịt chắc ngọt và tách xương dễ; sốt thanh, thơm gừng hành, da cá không nát.",
      service:
        "Phục vụ ngay khi còn nóng. Thời gian hấp điều chỉnh theo khối lượng thực tế của cá.",
    }),
  ],
  [
    "Cá chẽm hấp xì dầu",
    guide({
      preparation:
        "Làm sạch cá chẽm, thấm khô và khứa thân; thái gừng, hành lá; pha xì dầu theo định lượng của từng biến thể.",
      cooking:
        "Hấp cá trên hơi nước mạnh đến khi thịt chín vừa. Đun nóng phần xì dầu với gừng và một lượng nhỏ dầu.",
      finishing:
        "Chắt bỏ nước hấp dư, rải hành gừng và rưới xì dầu nóng; kiểm tra đủ định lượng theo phần hoặc theo kilogram.",
      quality:
        "Thịt cá trắng, mọng và không bở; sốt thơm, mặn vừa; cá nguyên hình và không có mùi tanh.",
      service:
        "Phục vụ ngay. Mỗi con cá phải được cân trước chế biến để áp dụng đúng biến thể bán.",
    }),
  ],
  [
    "Mực lá nướng sa tế",
    guide({
      preparation:
        "Làm sạch mực lá, bỏ túi mực và màng, rửa nhanh rồi thấm khô; khứa caro nhẹ. Trộn sa tế, sả, tỏi và dầu theo định lượng.",
      cooking:
        "Ướp mực ngắn để không ra nước, nướng trên nhiệt cao vừa và trở nhanh. Quét thêm sốt mỏng đến khi mực chín, bề mặt xém nhẹ.",
      finishing:
        "Cắt mực vừa ăn, xếp lại hình và thêm rau thơm; không đổ phần nước ướp sống lên món.",
      quality:
        "Mực giòn ngọt, không dai; mùi sả sa tế rõ, bề mặt không cháy đen và không chảy nhiều nước.",
      service:
        "Phục vụ ngay sau nướng. Mực sống giữ lạnh và chỉ lấy ra theo từng đơn.",
    }),
  ],
  [
    "Tôm sú rang muối",
    guide({
      preparation:
        "Rửa tôm, cắt râu, rút chỉ lưng và để thật ráo; trộn muối, tiêu, tỏi và ớt theo định lượng của biến thể.",
      cooking:
        "Rang hoặc áp chảo tôm đến khi vỏ chuyển màu và tôm vừa chín. Cho hỗn hợp muối tỏi vào đảo nhanh để bám đều, tránh rang quá lâu.",
      finishing:
        "Loại bỏ dầu thừa, rắc phần gia vị rang còn lại và xếp tôm gọn trên đĩa.",
      quality:
        "Vỏ tôm giòn nhẹ, thịt chắc ngọt; gia vị khô bám đều, không quá mặn và không cháy tỏi.",
      service:
        "Phục vụ nóng. Cân tôm trước chế biến để đúng định lượng phần hoặc kilogram.",
    }),
  ],
  [
    "Cua Cà Mau sốt me",
    guide({
      preparation:
        "Chà rửa cua sạch, kiểm tra cua còn tươi, cân đúng khối lượng rồi sơ chế; băm tỏi, ớt và pha sốt me chua ngọt.",
      cooking:
        "Làm chín cua bằng phương pháp phù hợp, sau đó phi tỏi và đun sốt me đến khi sánh. Cho cua vào đảo hoặc rưới sốt để phủ đều các phần.",
      finishing:
        "Xếp cua theo hình ban đầu, rưới đủ sốt và thêm rau thơm; chuẩn bị dụng cụ ăn cua.",
      quality:
        "Thịt cua chín, chắc và ngọt; sốt me bóng, chua ngọt cân bằng, không có mùi lạ.",
      service:
        "Phục vụ ngay. Cua sống phải được bảo quản đúng điều kiện và không dùng cua chết không rõ thời điểm.",
    }),
  ],
  [
    "Nghêu hấp sả",
    guide({
      preparation:
        "Ngâm nghêu cho nhả cát, chà rửa vỏ và loại bỏ con há miệng không khép; đập dập sả, thái gừng và ớt.",
      cooking:
        "Cho sả, gừng và một lượng nước vừa đủ vào nồi, đun sôi rồi cho nghêu vào hấp đậy nắp. Dừng khi nghêu mở miệng đồng đều.",
      finishing:
        "Đảo nhẹ, loại bỏ con không mở miệng và múc cả nghêu lẫn nước hấp ra tô.",
      quality:
        "Nghêu ngọt, không cát; nước hấp trong, thơm sả gừng và không quá mặn.",
      service:
        "Phục vụ nóng ngay sau hấp. Không giữ lại nghêu đã nấu qua ca.",
    }),
  ],
  [
    "Gà nướng lu",
    guide({
      preparation:
        "Làm sạch gà ta, để ráo, tạo đường thoát nhiệt ở phần dày và ướp gia vị cả trong lẫn ngoài. Để gà thấm trong điều kiện lạnh.",
      cooking:
        "Nướng lu ở nhiệt ổn định, xoay gà định kỳ để da vàng đều. Quét lớp sốt mỏng và nướng đến khi phần thịt dày nhất chín hoàn toàn.",
      finishing:
        "Để gà nghỉ trước khi chặt, chặt miếng đều và xếp lại hình; nước chấm để riêng.",
      quality:
        "Da vàng thơm, không cháy; thịt chín đều, còn mọng và không có dịch hồng ở sát xương.",
      service:
        "Phục vụ nóng. Gà đã nướng không để ở nhiệt độ phòng lâu và không nướng lại nhiều lần.",
    }),
  ],
  [
    "Sườn non nướng mật ong",
    guide({
      preparation:
        "Cắt sườn non theo phần, rửa nhanh, thấm khô và ướp mật ong, tỏi, nước mắm cùng gia vị trong điều kiện lạnh.",
      cooking:
        "Nướng sườn ở lửa vừa, trở đều và quét sốt từng lớp mỏng. Tiếp tục đến khi sườn chín, mềm và bề mặt óng vàng.",
      finishing:
        "Để sườn nghỉ ngắn, cắt theo xương và xếp cùng rau ăn kèm; sốt dùng kèm phải được đun chín.",
      quality:
        "Thịt mềm, không khô; lớp mật ong vàng nâu, không cháy đắng; phần sát xương chín hoàn toàn.",
      service:
        "Phục vụ nóng ngay sau nướng. Không dùng lại sốt ướp sống nếu chưa đun sôi kỹ.",
    }),
  ],
  [
    "Lẩu hải sản chua cay",
    guide({
      preparation:
        "Làm sạch tôm, mực và nghêu; cắt mực vừa ăn, ngâm nghêu nhả cát; rửa nấm và rau. Chuẩn bị nền nước lẩu chua cay.",
      cooking:
        "Nấu nền nước lẩu đến khi vị chua, cay, mặn và ngọt cân bằng. Khi phục vụ, đun sôi nước lẩu rồi cho hải sản theo thứ tự chín lâu trước, chín nhanh sau.",
      finishing:
        "Xếp hải sản, nấm và rau riêng, sạch và đủ định lượng; hướng dẫn khách nấu chín từng nguyên liệu trước khi dùng.",
      quality:
        "Nước lẩu trong vừa, thơm và không gắt; hải sản tươi, không tanh; rau nấm không dập úng.",
      service:
        "Giữ hải sản sống/lạnh đến lúc lên bàn. Không bổ sung hải sản mới vào nồi đã để nguội lâu.",
    }),
  ],
  [
    "Lẩu gà lá é",
    guide({
      preparation:
        "Chặt gà ta miếng đều, chần sơ nếu cần; rửa lá é, nấm và chuẩn bị ớt. Nấu sẵn nền nước dùng gà trong.",
      cooking:
        "Nấu gà trong nước dùng đến khi chín mềm, nêm vị thanh. Cho nấm vào trước, lá é và ớt cho sau cùng để giữ mùi thơm.",
      finishing:
        "Xếp gà, nấm và lá é đủ định lượng; nước lẩu phải sôi trước khi giao bàn.",
      quality:
        "Nước lẩu ngọt thanh, thơm lá é; gà chín mềm nhưng không nát; lá é xanh và không bị đắng.",
      service:
        "Phục vụ trên bếp lẩu, nhắc khách duy trì sôi nhẹ. Phần gà phải chín hoàn toàn trước khi ăn.",
    }),
  ],
  [
    "Cơm chiên hải sản",
    guide({
      preparation:
        "Dùng cơm nguội đã bảo quản đúng cách, bóp tơi; làm sạch và cắt tôm mực; đánh trứng, cắt rau củ và hành.",
      cooking:
        "Làm nóng chảo, xào chín hải sản rồi lấy ra. Chiên trứng và cơm trên lửa lớn đến khi hạt cơm tơi, sau đó cho rau củ và hải sản trở lại, nêm vừa vị.",
      finishing:
        "Đảo nhanh cho khô ráo, thêm hành và tiêu rồi xếp cơm gọn trên đĩa.",
      quality:
        "Hạt cơm tơi, không vón và không quá dầu; hải sản chín vừa, rau củ còn màu.",
      service:
        "Phục vụ nóng. Cơm dùng để chiên phải được làm nguội và bảo quản lạnh đúng quy trình.",
    }),
  ],
  [
    "Mì xào bò",
    guide({
      preparation:
        "Trụng mì vừa mềm rồi xả và để ráo; thái bò mỏng, cắt hành tây, ớt chuông và rau; pha sốt xào.",
      cooking:
        "Áp chảo bò nhanh trên chảo nóng rồi lấy ra. Xào rau, cho mì và sốt vào đảo tơi, sau đó cho bò trở lại và đảo ngắn.",
      finishing:
        "Nêm lại, rắc tiêu và xếp mì cao gọn; không để sốt đọng dưới đĩa.",
      quality:
        "Mì tơi, dai vừa, không nhũn; bò mềm, rau còn giòn và sốt bám đều.",
      service:
        "Phục vụ ngay sau xào; không giữ mì đã xào trên bếp nóng.",
    }),
  ],
  [
    "Cháo hải sản",
    guide({
      preparation:
        "Vo gạo, làm sạch tôm và mực, cắt vừa ăn; thái gừng, hành lá và chuẩn bị tiêu. Hải sản giữ lạnh đến khi nấu.",
      cooking:
        "Nấu gạo đến khi cháo mềm, nêm nền vừa vị. Cho tôm mực vào gần cuối và nấu vừa chín, sau đó thêm gừng.",
      finishing:
        "Múc đủ hải sản, rắc hành lá và tiêu; kiểm tra không còn vỏ hoặc dị vật.",
      quality:
        "Cháo sánh mịn, không khê; hải sản giòn ngọt, không dai; mùi gừng hành rõ và không tanh.",
      service:
        "Phục vụ nóng. Không giữ hải sản chín trong nồi cháo quá lâu.",
    }),
  ],
  [
    "Cánh gà chiên nước mắm",
    guide({
      preparation:
        "Làm sạch cánh gà, để ráo và ướp nhẹ; băm tỏi, pha sốt nước mắm và đường; cắt dưa leo ăn kèm.",
      cooking:
        "Chiên cánh gà đến khi vàng và chín hoàn toàn, để ráo dầu. Phi tỏi, đun sốt nước mắm sánh nhẹ rồi đảo cánh gà nhanh cho áo đều.",
      finishing:
        "Tắt bếp khi sốt vừa bám, xếp cùng dưa leo và rắc tỏi phi.",
      quality:
        "Da gà vàng, thịt chín mọng; sốt mặn ngọt cân bằng, không cháy đường và không quá nhiều dầu.",
      service:
        "Phục vụ nóng. Không dùng lại dầu chiên đã xuống màu hoặc có mùi lạ.",
    }),
  ],
  [
    "Khoai tây chiên",
    guide({
      preparation:
        "Gọt và cắt khoai thành thanh đều, rửa bớt tinh bột, làm ráo hoàn toàn; chuẩn bị dầu sạch, muối và tương ớt.",
      cooking:
        "Chiên khoai theo mẻ nhỏ đến khi chín và vàng giòn; vớt ra để ráo dầu. Có thể chiên hai giai đoạn theo quy trình bếp.",
      finishing:
        "Rắc muối khi khoai còn nóng, xếp vào rổ hoặc đĩa thoáng và để tương ớt riêng.",
      quality:
        "Khoai vàng đều, vỏ giòn, ruột mềm; không ngấm dầu, không cháy và không có mùi dầu cũ.",
      service:
        "Phục vụ ngay; không đậy kín khoai nóng hoặc chiên lại khoai đã để lâu.",
    }),
  ],
  [
    "Soda chanh",
    guide({
      preparation:
        "Rửa chanh, vắt lấy nước và lọc hạt; chuẩn bị nước đường, soda lạnh và đá sạch.",
      cooking:
        "Hòa nước chanh với nước đường, sau đó thêm soda từ từ. Khuấy nhẹ để giữ độ sủi.",
      finishing:
        "Rót vào ly đá, thêm lát chanh và kiểm tra ly sạch, không nứt mẻ.",
      quality:
        "Vị chua thanh, ngọt vừa, soda còn ga; nước trong và không đắng vỏ.",
      service:
        "Phục vụ ngay sau khi pha; soda đã mở phải được đậy kín và giữ lạnh.",
    }),
  ],
  [
    "Dưa hấu lạnh",
    guide({
      preparation:
        "Rửa sạch vỏ dưa trước khi cắt, dùng dao và thớt sạch; bỏ phần dập, cắt miếng đều và loại hạt lớn.",
      cooking:
        "Không qua nhiệt. Làm lạnh dưa đã cắt trong hộp kín ở nhiệt độ bảo quản phù hợp.",
      finishing:
        "Xếp miếng dưa gọn, không chạm tay trực tiếp vào phần ăn và để ráo nước dư.",
      quality:
        "Dưa đỏ tự nhiên, giòn ngọt, không nhũn, không có mùi lên men và không lẫn phần vỏ.",
      service:
        "Phục vụ lạnh; dưa đã cắt phải bảo quản kín và sử dụng trong ngày.",
    }),
  ],
]);

const REQUIRED_SECTIONS = [
  "Sơ chế:",
  "Chế biến:",
  "Hoàn thiện:",
  "Tiêu chuẩn thành phẩm:",
  "Phục vụ và bảo quản:",
];

function getArgValue(prefix) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function validateRecipeGuides() {
  if (RECIPE_GUIDES.size !== 36) {
    throw new Error(`Expected 36 recipe guides, got ${RECIPE_GUIDES.size}`);
  }

  for (const [dishName, notes] of RECIPE_GUIDES) {
    if (!dishName.trim() || !notes.trim()) {
      throw new Error("Recipe guide contains an empty dish name or notes");
    }
    for (const section of REQUIRED_SECTIONS) {
      if (!notes.includes(section)) {
        throw new Error(`Recipe guide for "${dishName}" is missing section "${section}"`);
      }
    }
  }

  return { dishes: RECIPE_GUIDES.size, sectionsPerRecipe: REQUIRED_SECTIONS.length };
}

function runCatalogSeed(requestedRestaurantId) {
  const scriptPath = fileURLToPath(
    new URL("./seedProductionMenuCatalogWithMenus.js", import.meta.url),
  );
  const args = [scriptPath, "--apply"];
  if (requestedRestaurantId) args.push(`--restaurantId=${requestedRestaurantId}`);

  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Production catalog seed failed with exit code ${result.status}`);
  }
}

async function requireRestaurant(target) {
  const restaurant = await Restaurant.findById(target.id).select({
    _id: 1,
    name: 1,
    brandId: 1,
  });
  if (!restaurant) throw new Error(`Restaurant not found: ${target.id}`);
  if (restaurant.name !== target.expectedName) {
    throw new Error(
      `Restaurant ${target.id} name mismatch: expected "${target.expectedName}", got "${restaurant.name}"`,
    );
  }
  if (String(restaurant.brandId || "") !== EXPECTED_BRAND_ID) {
    throw new Error(`Restaurant ${target.id} does not belong to brand ${EXPECTED_BRAND_ID}`);
  }
  return restaurant;
}

async function rebuildRestaurantRecipes(target) {
  const restaurant = await requireRestaurant(target);
  const dishNames = [...RECIPE_GUIDES.keys()];
  const menuItems = await MenuItem.find({
    restaurantId: restaurant._id,
    name: { $in: dishNames },
  })
    .select({ _id: 1, name: 1 })
    .lean();

  const itemsByName = new Map();
  for (const item of menuItems) {
    const bucket = itemsByName.get(item.name) || [];
    bucket.push(item);
    itemsByName.set(item.name, bucket);
  }

  for (const dishName of dishNames) {
    const matches = itemsByName.get(dishName) || [];
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one menu item named "${dishName}" in ${target.expectedName}, got ${matches.length}`,
      );
    }
  }

  const menuItemIds = menuItems.map((item) => item._id);
  const recipes = await Recipe.find({
    restaurantId: restaurant._id,
    menuItemId: { $in: menuItemIds },
  }).lean();
  const recipeByMenuItemId = new Map(
    recipes.map((recipe) => [String(recipe.menuItemId), recipe]),
  );

  const ingredientIds = new Set();
  for (const recipe of recipes) {
    for (const variant of recipe.servingVariants || []) {
      for (const line of variant.ingredients || []) {
        if (line.ingredientId) ingredientIds.add(String(line.ingredientId));
      }
    }
  }

  const validIngredients = await Ingredient.find({
    _id: { $in: [...ingredientIds] },
    restaurantId: restaurant._id,
  })
    .select({ _id: 1 })
    .lean();
  if (validIngredients.length !== ingredientIds.size) {
    throw new Error(
      `${target.expectedName} has recipe ingredient references outside its restaurant scope`,
    );
  }

  let updatedRecipes = 0;
  for (const [dishName, notes] of RECIPE_GUIDES) {
    const menuItem = itemsByName.get(dishName)[0];
    const recipe = recipeByMenuItemId.get(String(menuItem._id));
    if (!recipe) {
      throw new Error(`Recipe was not recreated for "${dishName}" in ${target.expectedName}`);
    }
    if (!Array.isArray(recipe.servingVariants) || recipe.servingVariants.length === 0) {
      throw new Error(`Recipe for "${dishName}" has no serving variants`);
    }

    await Recipe.updateOne(
      { _id: recipe._id, restaurantId: restaurant._id, menuItemId: menuItem._id },
      {
        $set: {
          notes,
          isActive: true,
          deletedAt: null,
          deleteExpiresAt: null,
        },
      },
      { runValidators: true },
    );
    updatedRecipes += 1;
  }

  return {
    restaurantId: String(restaurant._id),
    restaurantName: restaurant.name,
    menuItems: menuItems.length,
    recipes: updatedRecipes,
    ingredientReferences: ingredientIds.size,
  };
}

async function main() {
  const validation = validateRecipeGuides();
  const apply = process.argv.includes("--apply");
  const requestedRestaurantId = getArgValue("--restaurantId=");
  const targets = requestedRestaurantId
    ? TARGET_RESTAURANTS.filter((target) => target.id === requestedRestaurantId)
    : TARGET_RESTAURANTS;

  if (!targets.length) {
    throw new Error(`Unsupported restaurantId: ${requestedRestaurantId}`);
  }

  console.log("Recipe guide validation passed:", validation);
  if (!apply) {
    console.log("No database changes were made. Add --apply to rebuild recipes.");
    return;
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required when --apply is used");
  }

  runCatalogSeed(requestedRestaurantId);

  const dbName = process.env.MONGO_DB?.trim();
  console.log("Connecting to update recipe instructions:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});

  try {
    const results = [];
    for (const target of targets) {
      results.push(await rebuildRestaurantRecipes(target));
    }
    console.table(results);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
