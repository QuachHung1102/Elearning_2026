import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { translate } from "@/lib/translations";

export const metadata: Metadata = {
  title: "Dấu ấn sẻ chia / Our Impact",
  description:
    "The CodingBuddy: learning, sharing, and supporting educational opportunities in northern Vietnam.",
};

export default async function ImpactPage() {
  const locale = await getLocale();
  const t = (vi: string, en: string) => translate(locale, vi, en);
  const figures = [
    ["200+", "học sinh được trực tiếp giảng dạy", "students taught personally"],
    [
      "80+",
      "học sinh đạt giải hoặc chứng nhận",
      "students earning awards or certificates",
    ],
    [
      "150+",
      "học sinh dân tộc thiểu số được tiếp cận lớp học",
      "ethnic minority students reached through classes",
    ],
    [
      "100%",
      "lợi nhuận dành cho giáo dục cộng đồng",
      "of profits dedicated to community education",
    ],
  ];
  return (
    <div className="page-shell impact-page">
      <section className="impact-intro" aria-labelledby="impact-title">
        <div>
          <p className="section-label">{t("Dấu ấn sẻ chia", "Our Impact")}</p>
          <h1 id="impact-title">
            {t(
              "Kiến thức được sẻ chia.\nCơ hội được mở ra.",
              "Knowledge shared.\nOpportunities opened.",
            )}
          </h1>
          <p className="impact-lead">
            {t(
              "Mình luôn tin kiến thức có ý nghĩa hơn khi được chia sẻ. CodingBuddy bắt đầu từ niềm yêu thích lập trình, và từ mong muốn để nhiều bạn nhỏ có cơ hội học, thử và tự tạo nên điều có ích.",
              "I have always believed knowledge means more when it is shared. CodingBuddy began with my love of programming and a wish for more young people to have the chance to learn, experiment, and make something useful.",
            )}
          </p>
          <p className="impact-byline">
            Nguyễn Hải Nam ·{" "}
            {t("Người sáng lập & người dạy", "Founder & lead tutor")}
          </p>
          <a className="inline-link" href="#beyond-the-screen">
            {t(
              "Từ lớp học đến cộng đồng",
              "From the classroom to the community",
            )}{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
        <figure className="impact-photo impact-hero-photo">
          <Image
            src="/images/impact/computer-classroom.png"
            width={2400}
            height={1600}
            sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1280px) 45vw, 540px"
            alt={t(
              "Học sinh cùng người hướng dẫn thực hành tại các dãy máy tính trong lớp học",
              "Students and tutors working together at rows of classroom computers",
            )}
            preload
          />
          <figcaption>
            {t(
              "Cùng thực hành trong lớp học kỹ năng số.",
              "Hands-on learning in a digital skills classroom.",
            )}
          </figcaption>
        </figure>
      </section>

      <section
        className="impact-numbers"
        aria-label={t("Một số dấu mốc", "Selected milestones")}
      >
        {figures.map(([value, vi, en]) => (
          <div key={vi}>
            <strong>{value}</strong>
            <span>{t(vi, en)}</span>
          </div>
        ))}
      </section>
      <p className="impact-source">
        {t(
          "Số liệu do người sáng lập tổng hợp cho giai đoạn sáu tháng hoạt động, bao gồm hoạt động giảng dạy và cộng đồng ngoài nền tảng. Đây không phải số lượng khóa học hay video đang đăng trên website.",
          "Figures supplied by the founder for a six-month period, including teaching and community activities beyond this platform. They do not describe the number of courses or videos currently published on the website.",
        )}
      </p>

      <section className="impact-chapter" aria-labelledby="teaching-impact">
        <div className="impact-chapter-heading">
          <p className="section-label">
            01 / {t("Bắt đầu từ việc học", "Where learning begins")}
          </p>
          <h2 id="teaching-impact">
            {t(
              "Từ chương trình đầu tiên\nđến dự án của riêng mình.",
              "From a first program\nto a project of their own.",
            )}
          </h2>
        </div>
        <div className="impact-prose">
          <p>
            {t(
              "CodingBuddy dành cho học sinh 10–15 tuổi. Cùng các chuyên gia công nghệ và hơn năm giảng viên trẻ, mình xây dựng tài liệu giúp các bạn từng bước làm quen với Python, thuật toán, debugging, SQL, phân tích dữ liệu và nhập môn AI/ML.",
              "CodingBuddy is for students aged 10–15. Working with technology specialists and more than five young instructors, I developed materials that introduce Python, algorithms, debugging, SQL, data analysis, and introductory AI/ML step by step.",
            )}
          </p>
          <p>
            {t(
              "Trong hoạt động giảng dạy, đội ngũ đã phát triển hơn 20 video giáo dục và 30 bài học, bài tập thực hành. Với mình, bài học chỉ thực sự kết nối khi học sinh dùng kiến thức để giải quyết một việc cụ thể, rồi tự thử và sửa dự án của mình.",
              "Across our teaching activities, the team developed more than 20 educational videos and 30 lessons and practical exercises. For me, a lesson comes together when a student uses it to solve a specific problem, then tests and improves their own project.",
            )}
          </p>
          <p>
            {t(
              "Mình trực tiếp dạy hơn 200 học sinh và hướng dẫn các bạn tham gia hơn năm cuộc thi lập trình trong nước và quốc tế, trong đó có Bebras và Python Master. Hơn 80 bạn đạt giải thưởng hoặc chứng nhận. Điều mình trân trọng là các bạn dám bắt đầu, hỏi khi chưa hiểu và tự tin hơn với sản phẩm của mình.",
              "I personally taught more than 200 students and guided learners through more than five national and international coding competitions, including Bebras and Python Master. Over 80 earned awards or certificates. What I value is seeing them willing to start, ask questions, and grow more confident in what they make.",
            )}
          </p>
        </div>
      </section>

      <section
        id="beyond-the-screen"
        className="impact-community"
        aria-labelledby="community-impact"
      >
        <div className="impact-community-intro">
          <p className="section-label">
            02 / {t("Tiếp nối ngoài màn hình", "Beyond the screen")}
          </p>
          <h2 id="community-impact">
            {t(
              "Một lớp học có thể\nmở thêm một lớp học.",
              "One classroom can\nhelp open another.",
            )}
          </h2>
          <p>
            {t(
              "Trong sáu tháng, CodingBuddy tạo ra hơn 30 triệu đồng doanh thu. Toàn bộ lợi nhuận được tái đầu tư cho hoạt động giáo dục cộng đồng dân tộc thiểu số tại miền núi phía Bắc Việt Nam.",
              "In six months, CodingBuddy generated more than VND 30 million in revenue. All profits were reinvested in education for ethnic minority communities in the mountainous regions of northern Vietnam.",
            )}
          </p>
          <p className="impact-finance-note">
            {t(
              "30 triệu đồng là doanh thu, không phải số tiền quyên góp. Cam kết 100% áp dụng cho lợi nhuận.",
              "VND 30 million is revenue, not the donation total. The 100% commitment applies to profits.",
            )}
          </p>
        </div>
        <div className="impact-community-details">
          <dl>
            <div>
              <dt>10+</dt>
              <dd>
                {t(
                  "máy tính & thiết bị điện tử phục vụ học tập",
                  "computers and electronic devices for learning",
                )}
              </dd>
            </div>
            <div>
              <dt>10+</dt>
              <dd>
                {t(
                  "lớp học Coding & kỹ năng số",
                  "coding and digital literacy classes",
                )}
              </dd>
            </div>
            <div>
              <dt>5+</dt>
              <dd>
                {t("tỉnh miền núi phía Bắc", "northern mountainous provinces")}
              </dd>
            </div>
          </dl>
          <p>
            {t(
              "Các lớp học đã tiếp cận hơn 150 học sinh dân tộc thiểu số, trong đó có các bạn Tày, Nùng và Dao. Hoạt động trải rộng tại các địa bàn như Lào Cai, Yên Bái và Phú Thọ, giúp các bạn làm quen với máy tính, kỹ năng số và những bước đầu lập trình.",
              "The classes reached more than 150 ethnic minority students, including Tày, Nùng, and Dao learners. Activities covered areas including Lào Cai, Yên Bái, and Phú Thọ, introducing computers, digital skills, and first steps in coding.",
            )}
          </p>
        </div>
      </section>

      <section
        className="impact-photo-story"
        aria-labelledby="impact-photos-title"
      >
        <p className="section-label">
          {t("Ghi lại từ những buổi sẻ chia", "Moments from our activities")}
        </p>
        <h2 id="impact-photos-title">
          {t(
            "Những người cùng học.\nNhững điều cùng làm.",
            "Learning together.\nMaking things happen.",
          )}
        </h2>
        <div className="impact-gallery">
          {[
            {
              name: "equipment-handover",
              width: 2470,
              height: 1646,
              titleVi: "Thêm thiết bị cho việc học",
              titleEn: "More tools for learning",
              captionVi: "Trao tặng máy tính và thiết bị phục vụ lớp học.",
              captionEn:
                "Providing a computer and equipment for the classroom.",
              altVi:
                "Người tham gia cùng đại diện lớp học trao hộp máy tính HP, bên cạnh các hộp thiết bị",
              altEn:
                "Participants presenting an HP computer box beside other classroom equipment",
            },
            {
              name: "laptops-for-learning",
              width: 2194,
              height: 1646,
              titleVi: "Máy tính đến gần hơn",
              titleEn: "Bringing computers within reach",
              captionVi: "Chia sẻ máy tính xách tay cùng các em học sinh.",
              captionEn: "Sharing laptops with young learners.",
              altVi:
                "Học sinh và người hướng dẫn cùng cầm máy tính xách tay trong lớp học",
              altEn:
                "Students and tutors holding laptops together in a classroom",
            },
            {
              name: "learning-together",
              width: 2470,
              height: 1646,
              titleVi: "Học bằng cách cùng thử",
              titleEn: "Learning by trying together",
              captionVi:
                "Một nhóm học sinh cùng theo dõi và thực hành trên máy tính.",
              captionEn:
                "A small group following along and practising on a laptop.",
              altVi:
                "Các học sinh ngồi quanh một máy tính xách tay trên bàn học",
              altEn:
                "A group of students gathered around a laptop at a classroom desk",
            },
            {
              name: "classroom-session",
              width: 2470,
              height: 1646,
              titleVi: "Một buổi học, nhiều khám phá",
              titleEn: "A classroom full of discoveries",
              captionVi:
                "Người hướng dẫn đồng hành cùng học sinh trong buổi học máy tính.",
              captionEn:
                "Tutors working alongside students during a computer lesson.",
              altVi:
                "Người hướng dẫn đứng phía bảng, học sinh thực hành tại các dãy máy tính",
              altEn:
                "Tutors at the front of a classroom as students work at desktop computers",
            },
          ].map((photo) => (
            <figure className="impact-photo" key={photo.name}>
              <Image
                src={`/images/impact/${photo.name}.png`}
                width={photo.width}
                height={photo.height}
                sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1280px) 45vw, 580px"
                alt={t(photo.altVi, photo.altEn)}
              />
              <figcaption>
                <strong>{t(photo.titleVi, photo.titleEn)}</strong>
                <span>{t(photo.captionVi, photo.captionEn)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="impact-closing" aria-labelledby="impact-next">
        <p className="section-label">
          03 / {t("Điều mình muốn tiếp tục", "What I want to keep doing")}
        </p>
        <h2 id="impact-next">
          {t(
            "Để điều mình biết\nđi xa hơn mình.",
            "Let what we know\nreach beyond us.",
          )}
        </h2>
        <p>
          {t(
            "Với mình, điều đáng nhớ nhất không chỉ là những con số. Đó là khi kiến thức được truyền tiếp, khi một bạn nhỏ khám phá ra mình cũng có thể tạo ra thứ gì đó, và khi việc học mở thêm một lựa chọn cho tương lai.",
            "For me, the most meaningful part goes beyond the numbers. It is seeing knowledge passed on, a young learner discovering they can make something, and education opening another possibility for their future.",
          )}
        </p>
        <div className="impact-actions">
          <Link className="studio-button" href="/workshop">
            {t("Thử dự án miễn phí", "Try the free project")}{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link className="inline-link" href="/contact">
            {t("Trao đổi cùng Nam", "Talk with Nam")}{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
