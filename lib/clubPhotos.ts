export type ClubPhoto = {
  src: string;
  /** איפה לחתוך את התמונה בגיבור — כדי שהשחקנים לא ייפלו מאחורי כרטיס המשחק הבא */
  objectPosition?: string;
};

export const CLUB_PHOTOS: ClubPhoto[] = [
  { src: "/club/01.jpg?v=hasharon" },
  { src: "/club/02.jpg?v=hasharon" },
  { src: "/club/03.jpg?v=hasharon" },
  { src: "/club/04.jpg?v=hasharon" },
  { src: "/club/05.jpg?v=hasharon" },
  { src: "/club/06.jpg?v=hasharon2", objectPosition: "center 62%" },
  { src: "/club/07.jpg?v=hasharon" },
  { src: "/club/08.jpg?v=hasharon" },
  { src: "/club/09.jpg?v=hasharon" },
  { src: "/club/10.jpg?v=hasharon" },
  { src: "/club/11.jpg?v=hasharon", objectPosition: "center 78%" },
  { src: "/club/12.jpg?v=hasharon" },
];
