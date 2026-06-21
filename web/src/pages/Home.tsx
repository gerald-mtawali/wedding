import Hero from "../components/home/Hero";
import Gallery from "../components/home/Gallery";
import OurStory from "../components/home/OurStory";
import SaveTheDate from "../components/home/SaveTheDate";
import ImportantDates from "../components/home/ImportantDates";
import RsvpCta from "../components/home/RsvpCta";

export default function Home() {
  return (
    <>
      <Hero />
      <Gallery />
      <OurStory />
      <SaveTheDate />
      <ImportantDates />
      <RsvpCta />
    </>
  );
}
