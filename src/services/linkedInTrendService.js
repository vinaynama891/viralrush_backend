class LinkedInTrendService {
  static async getTrending(query = "", niche = "") {
    const qTerm = query || niche || "salary negotiation";
    return [
      {
        title: `The hidden secret to negotiating a $150K ${qTerm} without asking for a raise.`,
        niche: niche || "Finance",
        creator: "@career_wealth",
        platform: "LinkedIn",
        viralScore: 91,
        engagementLevel: "High",
        views: "340K",
        likes: "22K",
        comments: "980",
        engagementRate: "6.8%",
        postedTime: "3 days ago",
        thumbnail: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=60",
        hook: `Here's the exact script I used to negotiate an extra thirty thousand dollars...`,
        whyViral: "High corporate utility, realistic workplace script, and relatable professional scenario. Extremely high saving and bookmarking rates.",
        emotionalTrigger: "Relief, Authority & Validation",
        hookQuality: 89,
        retentionScore: 86,
        ctaScore: 92,
        psychology: "Negotiating causes severe social anxiety. Offering a safe, scripted path acts as high value-add, forcing users to click.",
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 91 },
          { name: "8s", value: 85 },
          { name: "15s", value: 80 },
          { name: "30s", value: 76 },
          { name: "45s", value: 72 },
          { name: "60s", value: 69 }
        ],
        improvements: "Convert the post structure into a clean PDF carousel download option to skyrocket the organic LinkedIn share metrics.",
        videoUrl: `https://www.linkedin.com/posts/mocked_li_post/`
      }
    ];
  }
}

module.exports = LinkedInTrendService;
