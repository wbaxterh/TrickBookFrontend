/**
 * Property builders for meaningful analytics events.
 *
 * The retention contract allows ids and bounded enums only: never captions,
 * names, emails, free text or coordinates. Keeping the mapping here means a
 * call site cannot accidentally forward a whole post or comment object.
 */

type PostLike = {
  _id?: string;
  mediaType?: 'video' | 'image' | 'carousel';
  spotId?: string | null;
  spot?: { _id?: string } | null;
  tricks?: unknown[] | null;
  visibility?: 'public' | 'homies' | 'private';
};

export type PostCreatedProperties = {
  post_id?: string;
  media_type?: 'video' | 'image' | 'carousel';
  has_spot: boolean;
  trick_count: number;
  visibility?: 'public' | 'homies' | 'private';
};

export function postCreatedProperties(post: PostLike | null | undefined): PostCreatedProperties {
  const properties: PostCreatedProperties = {
    has_spot: Boolean(post?.spotId || post?.spot?._id),
    trick_count: Array.isArray(post?.tricks) ? post.tricks.length : 0,
  };
  if (post?._id) properties.post_id = String(post._id);
  if (post?.mediaType) properties.media_type = post.mediaType;
  if (post?.visibility) properties.visibility = post.visibility;
  return properties;
}

export function commentCreatedProperties(postId: string, parentCommentId?: string | null) {
  return { post_id: postId, is_reply: Boolean(parentCommentId) };
}
