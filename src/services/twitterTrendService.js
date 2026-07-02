class TwitterTrendService {
  static async getTrending(query = "", niche = "") {
    const qTerm = query || niche || "AI tools";
    return [
      {
        title: `This new ${qTerm} is literally illegal. It does all your work while you sleep.`,
        niche: niche || "Marketing",
        creator: "@marketer_sam",
        platform: "Twitter",
        viralScore: 99,
        engagementLevel: "Explosive 🔥",
        views: "4.1M",
        likes: "410K",
        comments: "15K",
        engagementRate: "10.3%",
        postedTime: "5 hours ago",
        thumbnail: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=500&auto=format&fit=crop&q=60",
        hook: `This new automation tool feels illegal to know. It basically does your whole job...`,
        whyViral: "Controversy and hyperbolic words ('literally illegal'). Offers a shortcut to work productivity that borders on 'hacker' lifestyle.",
        emotionalTrigger: "Intense Intrigue, Greed & Curiosity",
        hookQuality: 98,
        retentionScore: 96,
        ctaScore: 94,
        psychology: "SaaS professionals and office workers dream of ultimate leverage. Promising passive work completion is a viral goldmine.",
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 98 },
          { name: "8s", value: 95 },
          { name: "15s", value: 92 },
          { name: "30s", value: 88 },
          { name: "45s", value: 84 },
          { name: "60s", value: 82 }
        ],
        improvements: "Add a disclaimer at the start of the thread/caption stating that this is fully compliant with API terms to establish trust early.",
        videoUrl: `https://twitter.com/marketer_sam/status/mocked_tw_status`
      }
    ];
  }
}

module.exports = TwitterTrendService;
