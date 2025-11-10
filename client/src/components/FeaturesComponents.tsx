import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Brain, Users, ClipboardList } from "lucide-react";

export default function FeaturesComponents() {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto">
      {/* Heading */}
      <div className="text-center max-w-3xl mx-auto mb-14">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-secondary to-orange-500">
          Powerful Features
        </h2>
        <p className="text-gray-400 text-lg md:text-xl">
          A complete AI-powered platform for teachers and students — from study materials to quizzes, assignments, and career growth.
        </p>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Notes from Teacher Docs */}
        <Card className="bg-[#111b30] border border-gray-700 hover:border-secondary/50 hover:shadow-xl hover:shadow-secondary/10 transition-all duration-300 rounded-xl">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-secondary mx-auto mb-6" />
            <h3 className="text-2xl text-white font-semibold mb-3">
              AI Notes Generator
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Teachers upload study material, and AI instantly creates{" "}
              <span className="text-secondary font-medium">summarized notes </span> 
              for students. Access is available when students{" "}
              <span className="text-secondary font-medium">join a group</span>.
            </p>
          </CardContent>
        </Card>

        {/* Practice & Interview Quizzes */}
        <Card className="bg-[#111b30] border border-gray-700 hover:border-secondary/50 hover:shadow-xl hover:shadow-secondary/10 transition-all duration-300 rounded-xl">
          <CardContent className="p-8 text-center">
            <Brain className="w-12 h-12 text-secondary mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-3">
              AI Quiz & Interview Prep
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Students can{" "}
              <span className="text-secondary font-medium">practice interviews</span>{" "}
              and AI will generate{" "}
              <span className="text-secondary font-medium">quizzes</span> based on 
              the uploaded content.
            </p>
          </CardContent>
        </Card>

        {/* Career Guidance */}
        <Card className="bg-[#111b30] border border-gray-700 hover:border-secondary/50 hover:shadow-xl hover:shadow-secondary/10 transition-all duration-300 rounded-xl">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-secondary mx-auto mb-6" />
            <h3 className="text-2xl text-white font-semibold mb-3">
              Career Guidance Bot
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Personalized <span className="text-secondary font-medium">career advice</span>{" "}
              to help students identify{" "}
              <span className="text-secondary font-medium">skills for the future </span> 
              and career paths.
            </p>
          </CardContent>
        </Card>

        {/* Teacher Assignments */}
        <Card className="bg-[#111b30] border border-gray-700 hover:border-secondary/50 hover:shadow-xl hover:shadow-secondary/10 transition-all duration-300 rounded-xl">
          <CardContent className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-secondary mx-auto mb-6" />
            <h3 className="text-2xl text-white font-semibold mb-3">
              Assignments & Tasks
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Teachers can 
              <span className="text-secondary font-medium">assign tasks </span> 
               and track student progress — making learning{" "}
              <span className="text-secondary font-medium">interactive & structured</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
