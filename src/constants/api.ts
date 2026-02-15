/**
 * API Constants
 * Backend URLs and configuration
 */

// Environment-based API URL
const isDevelopment = __DEV__;

// Use your computer's local IP for physical devices (localhost only works on simulators)
const DEV_API_HOST = '192.168.5.131';

export const API_CONFIG = {
  // Base URLs
  baseUrl: isDevelopment ? `http://${DEV_API_HOST}:9000/api` : 'https://api.thetrickbook.com/api',

  socketUrl: isDevelopment ? `http://${DEV_API_HOST}:9000` : 'https://api.thetrickbook.com',

  // Bunny.net CDN for video streaming
  bunnyCdnHostname: 'vz-9b8a66dd-b7b.b-cdn.net',

  // Timeouts (ms)
  timeout: 30000,
  uploadTimeout: 120000,

  // Retry configuration
  retryAttempts: 3,
  retryDelay: 1000,

  // Cache times (ms)
  cache: {
    short: 1000 * 60, // 1 minute
    medium: 1000 * 60 * 5, // 5 minutes
    long: 1000 * 60 * 30, // 30 minutes
  },
};

// API Endpoints
export const ENDPOINTS = {
  // Auth
  auth: {
    login: '/auth', // POST - email, password -> { token }
    register: '/users', // POST - name, email, password, sports
    googleAuth: '/auth/google-auth', // POST - tokenId
    appleAuth: '/auth/apple-auth', // POST - identityToken, fullName, email
    forgotPassword: '/users/forgot-password',
    resetPassword: '/users/reset-password',
  },

  // User
  user: {
    me: '/user/me', // GET - current user
    count: '/user/count', // GET - total user count (public)
    profile: (id: string) => `/user/${id}`, // GET - user by ID
    publicProfile: (id: string) => `/user/${id}/public`, // GET - public profile
    stats: (id: string) => `/user/${id}/stats`, // GET - user stats
    activity: (id: string) => `/user/${id}/activity`, // GET - user activity
    update: (id: string) => `/user/${id}`, // PUT - update profile
    search: '/user/search',
  },

  // Tricks
  tricks: {
    list: '/tricks',
    detail: (id: string) => `/tricks/${id}`,
    categories: '/tricks/categories',
  },

  // TrickLists
  trickLists: {
    list: '/tricklists',
    detail: (id: string) => `/tricklists/${id}`,
    create: '/tricklists',
    update: (id: string) => `/tricklists/${id}`,
    delete: (id: string) => `/tricklists/${id}`,
    updateTrickStatus: (listId: string, trickId: string) =>
      `/tricklists/${listId}/tricks/${trickId}`,
  },

  // Spots
  spots: {
    list: '/spots',
    detail: (id: string) => `/spots/${id}`,
    create: '/spots',
    nearby: '/spots/nearby',
    search: '/spots/search',
  },

  // Spot Lists
  spotLists: {
    list: '/spotlists',
    detail: (id: string) => `/spotlists/${id}`,
    create: '/spotlists',
    update: (id: string) => `/spotlists/${id}`,
    delete: (id: string) => `/spotlists/${id}`,
  },

  // Spot Reviews
  spotReviews: {
    bySpot: (spotId: string) => `/spot-reviews/${spotId}`,
    create: '/spot-reviews',
    update: (reviewId: string) => `/spot-reviews/${reviewId}`,
    delete: (reviewId: string) => `/spot-reviews/${reviewId}`,
    helpful: (reviewId: string) => `/spot-reviews/${reviewId}/helpful`,
    byUser: (userId: string) => `/spot-reviews/user/${userId}`,
  },

  // Homies (Friends) - uses /users routes
  homies: {
    list: '/users/homies',
    discoverable: '/users/discoverable',
    requests: '/users/homie-requests',
    networkStatus: '/users/network-status',
    toggleNetwork: (userId: string) => `/users/${userId}/network`,
    sendRequest: (userId: string) => `/users/${userId}/homie-request`,
    accept: (userId: string) => `/users/${userId}/accept-homie`,
    reject: (userId: string) => `/users/${userId}/reject-homie`,
    remove: (homieId: string) => `/users/homie/${homieId}`,
    status: (targetId: string) => `/users/homie-status/${targetId}`,
  },

  // Direct Messages - uses /dm routes
  messages: {
    conversations: '/dm/conversations',
    conversation: (id: string) => `/dm/conversations/${id}`,
    messages: (conversationId: string) => `/dm/conversations/${conversationId}/messages`,
    startConversation: '/dm/conversations',
    sendMessage: (conversationId: string) => `/dm/conversations/${conversationId}/messages`,
    markRead: (conversationId: string) => `/dm/conversations/${conversationId}/read`,
    unreadCount: '/dm/unread-count',
  },

  // The Couch - Curated Media Library (uses /couch routes)
  couch: {
    videos: '/couch/videos',
    video: (id: string) => `/couch/videos/${id}`,
    stream: (id: string) => `/couch/videos/${id}/stream`,
    featured: '/couch/featured',
    collections: '/couch/collections',
    collection: (id: string) => `/couch/collections/${id}`,
    reaction: (id: string) => `/couch/videos/${id}/reaction`,
    removeReaction: (id: string, type: string) => `/couch/videos/${id}/reaction/${type}`,
    comments: (id: string) => `/couch/videos/${id}/comments`,
  },

  // The Feed - User-Generated Content
  feed: {
    list: '/feed',
    trending: '/feed/trending',
    saved: '/feed/saved',
    userPosts: (userId: string) => `/feed/user/${userId}`,
    bySport: (sport: string) => `/feed/sport/${sport}`,
    post: (postId: string) => `/feed/${postId}`,
    create: '/feed',
    update: (postId: string) => `/feed/${postId}`,
    delete: (postId: string) => `/feed/${postId}`,
    reaction: (postId: string) => `/feed/${postId}/reaction`,
    removeReaction: (postId: string, type: string) => `/feed/${postId}/reaction/${type}`,
    comments: (postId: string) => `/feed/${postId}/comments`,
    comment: (postId: string) => `/feed/${postId}/comments`,
    commentReplies: (postId: string, commentId: string) =>
      `/feed/${postId}/comments/${commentId}/replies`,
    loveComment: (postId: string, commentId: string) =>
      `/feed/${postId}/comments/${commentId}/love`,
    deleteComment: (postId: string, commentId: string) => `/feed/${postId}/comments/${commentId}`,
    save: (postId: string) => `/feed/${postId}/save`,
    view: (postId: string) => `/feed/${postId}/view`,
    report: (postId: string) => `/feed/${postId}/report`,
  },

  // Payments
  payments: {
    subscription: '/payments/subscription',
    checkout: '/payments/create-checkout-session',
    cancel: '/payments/cancel-subscription',
    reactivate: '/payments/reactivate-subscription',
  },

  // Upload (Video/Image)
  upload: {
    createVideo: '/upload/video/create',
    videoStatus: (videoId: string) => `/upload/video/${videoId}/status`,
    deleteVideo: (videoId: string) => `/upload/video/${videoId}`,
    imagePresign: '/upload/image/presign',
    deleteImage: '/upload/image',
  },
};

export default API_CONFIG;
