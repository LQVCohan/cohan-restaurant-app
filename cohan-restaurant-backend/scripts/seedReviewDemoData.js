import "dotenv/config.js";
import mongoose from "mongoose";
import { Notification, Restaurant, Review, ReviewComment, ReviewReport, User } from "../models/index.js";
import { REVIEW_SERVICE_TARGETS } from "../src/services/reviewHardening.service.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "foodhub";
const CONFIRM = process.env.SEED_REVIEW_DEMO === "true" || process.argv.includes("--confirm");
const DEMO_TAG = "graduation-review-demo";

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function upsertUser(email, payload) {
  return User.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, provider: "local", status: "active", ...payload } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  if (!CONFIRM) {
    throw new Error("Seed demo review data requires SEED_REVIEW_DEMO=true or --confirm to avoid touching real data accidentally.");
  }
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    throw new Error("Refusing to run in production without --allow-production.");
  }

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`✅ Connected Mongo ${DB_NAME}`);

  const manager = await upsertUser("review.manager.demo@cohan.local", { fullName: "Quản lý Review Demo", userType: "MANAGER" });
  const staff = await upsertUser("review.staff.demo@cohan.local", { fullName: "Nhân viên Phục vụ Demo", userType: "STAFF" });
  const customers = await Promise.all(
    Array.from({ length: 8 }, (_, index) => upsertUser(`review.customer${index + 1}@cohan.local`, { fullName: `Khách Demo ${index + 1}`, userType: "CUSTOMER" })),
  );

  const restaurant = await Restaurant.findOneAndUpdate(
    { name: "Cohan Graduation Review Demo" },
    {
      $setOnInsert: {
        name: "Cohan Graduation Review Demo",
        phone: "0900000000",
        email: "review.demo@cohan.local",
        publicationStatus: "published",
        operationalStatus: "normal",
        managerId: manager._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await User.updateOne({ _id: staff._id }, { $set: { restaurantForStaff: restaurant._id } });

  await Review.deleteMany({ tags: DEMO_TAG });
  await ReviewComment.deleteMany({ restaurantId: restaurant._id, content: /demo|ghi nhận|xin lỗi/i });
  await ReviewReport.deleteMany({ restaurantId: restaurant._id, detail: /demo/i });
  await Notification.deleteMany({ restaurantId: restaurant._id, "payload.demoTag": DEMO_TAG });

  const serviceTarget = REVIEW_SERVICE_TARGETS.find((target) => target.slug === "serving_speed");
  const reviewPayloads = [
    [5, "Bữa tối tuyệt vời", "Món ăn ngon, phục vụ nhanh và nhân viên rất thân thiện.", "published", true, ["food_quality", "staff_attitude"]],
    [4, "Không gian đẹp", "Nhà hàng sạch sẽ, ánh sáng đẹp, phù hợp chụp hình báo cáo demo.", "published", false, ["ambience", "cleanliness"]],
    [2, "Phục vụ hơi chậm", "Món ngon nhưng thời gian chờ lâu, cần quản lý phản hồi để khách yên tâm.", "published", true, ["service_speed"]],
    [1, "Trải nghiệm thanh toán chưa tốt", "Máy POS lỗi khiến khách phải chờ, cần xử lý gấp trước giờ cao điểm.", "published", false, ["payment", "service_speed"]],
    [5, "Nhân viên hỗ trợ tốt", "Bạn phục vụ tư vấn món rất kỹ, trải nghiệm tích cực.", "published", true, ["staff_attitude"]],
    [3, "Ổn định", "Món ăn ổn, giá hợp lý, không gian hơi ồn vào cuối tuần.", "published", true, ["price", "ambience"]],
    [4, "Đặt bàn thuận tiện", "Quy trình đặt bàn rõ ràng, nhân viên xác nhận nhanh.", "published", true, ["booking"]],
    [2, "Cần cải thiện vệ sinh", "Khu vực bàn gần cửa hơi bẩn, mong nhà hàng kiểm tra lại.", "pending", false, ["cleanliness"]],
    [5, "Sẽ quay lại", "Gia đình tôi hài lòng và sẽ quay lại vào dịp gần nhất.", "pending", false, ["food_quality"]],
    [3, "Review dịch vụ giao hàng", "Đóng gói chắc chắn, tốc độ giao hàng ở mức chấp nhận được.", "published", true, ["delivery"]],
  ];

  const reviews = [];
  for (const [index, item] of reviewPayloads.entries()) {
    const [rating, title, content, status, verifiedPurchase, topicTags] = item;
    const isService = index === 9;
    reviews.push(await Review.create({
      targetType: isService ? "service" : "restaurant",
      targetId: isService ? serviceTarget.id : restaurant._id,
      targetName: isService ? serviceTarget.name : restaurant.name,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      customerId: customers[index % customers.length]._id,
      customerName: customers[index % customers.length].fullName,
      staffId: index === 4 ? staff._id : null,
      staffName: index === 4 ? staff.fullName : "",
      rating,
      title,
      content,
      status,
      verifiedPurchase,
      verifiedSource: verifiedPurchase ? "manual" : "none",
      sentiment: rating <= 2 ? "negative" : rating >= 4 ? "positive" : "neutral",
      topicTags,
      tags: [DEMO_TAG, ...topicTags],
      commentsCount: index < 2 ? 1 : 0,
      reportsCount: index === 3 ? 1 : 0,
      helpfulCount: index + 1,
      createdAt: daysAgo(10 - index),
      updatedAt: daysAgo(10 - index),
      createdBy: customers[index % customers.length]._id,
    }));
  }

  for (const review of reviews.slice(0, 2)) {
    const reply = await ReviewComment.create({
      reviewId: review._id,
      restaurantId: restaurant._id,
      authorUserId: manager._id,
      authorName: restaurant.name,
      authorType: "manager",
      authorRole: "manager",
      officialReply: true,
      replyByRestaurantId: restaurant._id,
      content: review.rating <= 2 ? "Nhà hàng xin lỗi và đã ghi nhận để cải thiện trong ca tiếp theo." : "Cảm ơn bạn đã đánh giá, nhà hàng rất vui khi được phục vụ bạn.",
      status: "published",
      createdBy: manager._id,
      createdAt: new Date(new Date(review.createdAt).getTime() + 60 * 60 * 1000),
    });
    await Review.updateOne({ _id: review._id }, { $set: { firstOfficialReplyAt: reply.createdAt } });
  }

  const reportedReview = reviews[3];
  await ReviewReport.create({
    reviewId: reportedReview._id,
    restaurantId: restaurant._id,
    reporterUserId: customers[0]._id,
    reason: "other",
    detail: "demo report cho luồng xử lý báo cáo",
    status: "pending",
    createdBy: customers[0]._id,
  });
  await Notification.create({
    toUserId: manager._id,
    restaurantId: restaurant._id,
    type: "review.reported",
    payload: { demoTag: DEMO_TAG, reviewId: reportedReview.id, message: "Có báo cáo đánh giá mới cần xử lý" },
  });

  console.log("🎉 Seeded review graduation demo data");
  console.log(`Restaurant: ${restaurant.name} (${restaurant._id})`);
  console.log("Accounts: review.manager.demo@cohan.local, review.customer1@cohan.local ... generated random passwords if new.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
