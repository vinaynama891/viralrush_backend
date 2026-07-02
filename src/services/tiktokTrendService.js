class TiktokTrendService {
  static async getTrending(query = "", niche = "") {
    const qTerm = query || niche || "Fitness split";
    return [
      {
        title: `I did this extreme 30-day ${qTerm} challenge. Here is the body transformation split.`,
        niche: niche || "Fitness",
        creator: "@fit_lifestyle",
        platform: "TikTok",
        viralScore: 96,
        engagementLevel: "Explosive 🔥",
        views: "2.8M",
        likes: "340K",
        comments: "8.9K",
        engagementRate: "12.4%",
        postedTime: "1 day ago",
        thumbnail: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60",
        hook: `I tried this extreme ${qTerm} challenge for 30 days so you don't have to...`,
        whyViral: "Visual before-and-after proof always dominates. Humans are obsessed with body transformations and realistic physical case studies.",
        emotionalTrigger: "Inspiration, Suspense & Self-Discipline",
        hookQuality: 95,
        retentionScore: 91,
        ctaScore: 88,
        psychology: "Challenges evoke personal empathy. Watchers want to witness if the sacrifice pays off, keeping them hooked.",
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 97 },
          { name: "8s", value: 92 },
          { name: "15s", value: 87 },
          { name: "30s", value: 82 },
          { name: "45s", value: 77 },
          { name: "60s", value: 74 }
        ],
        improvements: "Accelerate the transition slides in the middle segment. A minor drop in retention occurred during the week-2 recap.",
        videoUrl: `https://www.tiktok.com/@fit_lifestyle/video/mocked_tt_video`
      }
    ];
  }
}

module.exports = TiktokTrendService;
