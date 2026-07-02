class InstagramTrendService {
  static async getTrending(query = "", niche = "") {
    const qTerm = query || niche || "SaaS";
    return [
      {
        title: `I built a fully automated ${qTerm} engine in 24 hours. Here is the exact stack.`,
        niche: niche || "Tech",
        creator: "@alex_growth",
        platform: "Instagram",
        viralScore: 98,
        engagementLevel: "Explosive 🔥",
        views: "1.4M",
        likes: "128K",
        comments: "4.2K",
        engagementRate: "9.4%",
        postedTime: "12 hours ago",
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
        hook: `Nobody talks about this automated ${qTerm} framework making side-hustlers rich...`,
        whyViral: "Leverages the massive wave of AI autonomy, provides concrete financial proof, and promises a friction-free blueprint. High curiosity gap.",
        emotionalTrigger: "Ambition & High Curiosity (Financial Independence)",
        hookQuality: 97,
        retentionScore: 94,
        ctaScore: 91,
        psychology: "Creators and side-hustlers seek low-friction technical setups. Providing the 'exact stack' validates the claims instantly.",
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 96 },
          { name: "8s", value: 91 },
          { name: "15s", value: 85 },
          { name: "30s", value: 81 },
          { name: "45s", value: 76 },
          { name: "60s", value: 73 }
        ],
        improvements: "Inject a clear subtitle overlay during the hook phase (first 3 seconds) to ensure mute users grasp the premise immediately.",
        videoUrl: `https://www.instagram.com/reel/C-nbFjoCklU/`
      }
    ];
  }
}

module.exports = InstagramTrendService;
