import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// The full pool of 25 questions
const QUESTION_POOL = [
    { id: 1, scenario: "The Instruction Manual,You bought a complex LEGO set. What do you do? Machine", options: [{ text: "Look for a model number or label.", type: "direct" }, { text: "Compare the parts to things you know (like gears to bike chains).", type: "analogy" }, { text: "Talk out loud to yourself to process how it might work.", type: "interactive" }] },
    { id: 2, scenario: "Grocery Store,You're in a rush shopping", options: [{ text: "Watch for visual facts (clocks, signs, items) to piece it together.", type: "direct" }, { text: "Compare characters to familiar archetypes (The Hero, The Villain).", type: "analogy" }, { text: "Focus on the tone, rhythm, and emotion of the voices.", type: "interactive" }] },
    { id: 3, scenario: "News,How do you get daily news?", options: [{ text: "Use a map to find the top 5 must-see landmarks.", type: "direct" }, { text: "Wander and see if the 'vibe' reminds you of another city.", type: "analogy" }, { text: "Join a guided walking tour to hear the local stories.", type: "interactive" }] },
    { id: 4, scenario: "Gift,You receive unknown gadget.", options: [{ text: "Search for the exact recipe and measurements online.", type: "direct" }, { text: "Guess the spices by comparing them to other dishes you've had.", type: "analogy" }, { text: "Call a friend or a chef to discuss how it was made.", type: "interactive" }] },
    { id: 5, scenario: "DIY Project,Starting home project", options: [{ text: "List your top 3 technical achievements.", type: "direct" }, { text: "What is this project most similar to in the real world?", type: "analogy" }, { text: "Explain your most complex idea to me in plain words.", type: "interactive" }] },
    { id: 6, scenario: "Movie Review,Helpful movie review is?", options: [{ text: "Follow the step-by-step manual from page 1.", type: "direct" }, { text: "Look at the picture on the box and wing it based on the 'look'.", type: "analogy" }, { text: "Ask someone who built it for their 'pro-tips' and advice.", type: "interactive" }] },
    { id: 7, scenario: "New Game,Learning strategy game", options: [{ text: "Follow a precise list organized by the store's aisles.", type: "direct" }, { text: "Look for 'meal sets' (e.g., chips near the salsa).", type: "analogy" }, { text: "Call home to have someone talk you through what's missing.", type: "interactive" }] },
    { id: 8, scenario: "Map,Viewing mountain map", options: [{ text: "Read a 5-bullet point summary of the morning headlines.", type: "direct" }, { text: "Read an editorial that compares today's events to history.", type: "analogy" }, { text: "Listen to a 10-minute news podcast while getting ready.", type: "interactive" }] },
    { id: 9, scenario: "Art Gallery,Viewing abstract painting", options: [{ text: "Search the web for the 'Technical Specs' of the device.", type: "direct" }, { text: "Think, 'This looks like a fancy version of X,' and try it.", type: "analogy" }, { text: "Ask the person who gave it to you for a verbal walkthrough.", type: "interactive" }] },
    { id: 10, scenario: "Constellations,Looking at stars", options: [{ text: "Draw a blueprint with exact measurements first.", type: "direct" }, { text: "Find a photo of a similar project and try to mimic it.", type: "analogy" }, { text: "Watch a video of someone explaining the process out loud.", type: "interactive" }] },
    { id: 11, scenario: "Recipe,Want spicy food", options: [{ text: "Look for a score (e.g., 8/10) and a list of technical 'Pros.'", type: "direct" }, { text: "Look for a comment saying, 'It's like Star Wars meets Jaws.'", type: "analogy" }, { text: "Watch a video of a critic talking about the acting and feel.", type: "interactive" }] },
    { id: 12, scenario: "Animal Personality,Describe personality as animal", options: [{ text: "Read the rulebook cover-to-cover before the first turn.", type: "direct" }, { text: "Ask, 'Is the movement in this game like Chess or Checkers?'", type: "analogy" }, { text: "Have someone explain the rules to you as you play.", type: "interactive" }] },
    { id: 13, scenario: "Song,New song you love — what sticks?", options: [{ text: "Look at the elevation numbers and GPS coordinates.", type: "direct" }, { text: "See shapes that look like 'sleeping giants' or 'jagged teeth.'", type: "analogy" }, { text: "Think of a story you heard about someone hiking these peaks.", type: "interactive" }] },
    { id: 14, scenario: "Presentation,Memorable presentation is?", options: [{ text: "Read the plaque to find the date, artist, and paint type.", type: "direct" }, { text: "Try to figure out what real-world object the shapes remind you of.", type: "analogy" }, { text: "Wish there was an audio headset explaining the artist's life.", type: "interactive" }] },
    { id: 15, scenario: "Language Learning,Learning new phrases", options: [{ text: "Identify the stars by their scientific brightness and names.", type: "direct" }, { text: "Connect the dots to find the 'Big Dipper' or 'The Lion.'", type: "analogy" }, { text: "Remember the myths and legends associated with the stars.", type: "interactive" }] },
    { id: 16, scenario: "Childhood Memory,Favorite holiday memory", options: [{ text: "Look for the Scoville heat units or 'Teaspoons of Chili.'", type: "direct" }, { text: "Think, 'I want it to kick like a mule but smell like a forest.'", type: "analogy" }, { text: "Ask a chef, 'On a scale of 1 to 10, how much will this hurt?'", type: "interactive" }] },
    { id: 17, scenario: "Meeting Role,In group meetings you…", options: [{ text: "Pick an animal based on 3 specific biological traits you share.", type: "direct" }, { text: "Pick an animal that symbolizes your 'vibe' or personality.", type: "analogy" }, { text: "Pick an animal because of a story or fable you once heard.", type: "interactive" }] },
    { id: 18, scenario: "Mystery Book,Reading detective novel", options: [{ text: "Focus on the BPM, the key, and the technical production.", type: "direct" }, { text: "Focus on the 'vibe' (e.g., 'This sounds like a neon city').", type: "analogy" }, { text: "Focus intensely on the lyrics and the story being told.", type: "interactive" }] },
    { id: 19, scenario: "Robot Design,Most important robot feature", options: [{ text: "Judge it by how clear and data-driven the slides were.", type: "direct" }, { text: "Judge it by how well the speaker used metaphors to explain things.", type: "analogy" }, { text: "Judge it by the speaker’s tone, jokes, and vocal energy.", type: "interactive" }] },
    { id: 20, scenario: "Forest Tree,See strange tree hiking", options: [{ text: "Memorize a grammar table and a list of 10 nouns.", type: "direct" }, { text: "Find words that sound like words you already know (cognates).", type: "analogy" }, { text: "Listen to a native speaker and repeat the sounds out loud.", type: "interactive" }] },
    { id: 21, scenario: "Broken Machine,Find old machine not working", options: [{ text: "Remember the exact date, the weather, and what you wore.", type: "direct" }, { text: "Remember the general 'feeling' compared to a normal day.", type: "analogy" }, { text: "Remember the jokes told and the voices of the people there.", type: "interactive" }] },
    { id: 22, scenario: "Foreign Film,Movie without subtitles", options: [{ text: "Be the one who writes down the 'Action Items' and 'Facts.'", type: "direct" }, { text: "Be the one who uses a sports metaphor to simplify the goal.", type: "analogy" }, { text: "Be the one who summarizes the verbal discussion for the group.", type: "interactive" }] },
    { id: 23, scenario: "New City,Exploring unknown city", options: [{ text: "Flip to the end to see 'who did it' before you finish reading.", type: "direct" }, { text: "Try to guess the killer based on common 'movie tropes.'", type: "analogy" }, { text: "Imagine the characters' distinct voices in your head as you read.", type: "interactive" }] },
    { id: 24, scenario: "Secret Ingredient,Recreate restaurant dish", options: [{ text: "Give it the ability to process 1,000 tasks with 0% error.", type: "direct" }, { text: "Give it the ability to learn by watching 'similar' human actions.", type: "analogy" }, { text: "Give it a voice that sounds perfectly human and conversational.", type: "interactive" }] },
    { id: 25, scenario: "Dream Job Interview,Hiring someone — ask one thing", options: [{ text: "Count the points on the leaves to identify the species.", type: "direct" }, { text: "Think, 'That tree looks like a hand reaching for the sky.'", type: "analogy" }, { text: "Look for a sign that tells the 'legend' or history of the tree.", type: "interactive" }] },
];

function LearningAssessment({ courseId, studentId, onComplete }) {
    const [questions, setQuestions] = useState([]);
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState({}); // { 1: "direct", 4: "analogy" }
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Select 5 random questions
        const shuffledPool = [...QUESTION_POOL].sort(() => 0.5 - Math.random());
        const selected = shuffledPool.slice(0, 5).map(q => ({
            ...q,
            // Shuffle options for display
            options: [...q.options].sort(() => 0.5 - Math.random())
        }));
        setQuestions(selected);
        setLoading(false);
    }, []);

    const handleOptionSelect = (value) => {
        const currentQId = questions[step].id;
        const newAnswers = { ...answers, [currentQId]: value };
        setAnswers(newAnswers);

        if (step < 4) {
            setStep(step + 1);
        } else {
            calculateAndSubmit(newAnswers);
        }
    };

    const calculateAndSubmit = async (finalAnswers) => {
        setSubmitting(true);

        // Count scores
        const counts = { direct: 0, analogy: 0, interactive: 0 };
        Object.values(finalAnswers).forEach(type => {
            if (counts[type] !== undefined) counts[type]++;
        });

        // Find max
        let maxCount = 0;
        let winningTypes = [];

        for (const [type, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                winningTypes = [type];
            } else if (count === maxCount) {
                winningTypes.push(type);
            }
        }

        // Tie-breaking (Randomly select one of the winners)
        const finalPattern = winningTypes[Math.floor(Math.random() * winningTypes.length)];

        try {
            const response = await fetch("http://localhost:5000/learning-patterns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId,
                    studentId,
                    answers: finalAnswers,
                    pattern: finalPattern
                })
            });

            if (response.ok) {
                onComplete();
            } else {
                alert("Failed to save assessment. Please try again.");
            }
        } catch (error) {
            console.error("Error saving assessment:", error);
            alert("Error saving assessment.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || submitting) {
        return (
            <div style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(255,255,255,0.95)",
                zIndex: 1000,
                display: "flex", justifyContent: "center", alignItems: "center"
            }}>
                <h2>{submitting ? "Analyzing your learning style..." : "Preparing assessment..."}</h2>
            </div>
        );
    }

    const currentQ = questions[step];

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(255,255,255,0.98)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "#333"
        }}>
            <div style={{
                backgroundColor: "#fff",
                padding: "40px",
                borderRadius: "16px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                maxWidth: "600px",
                width: "90%",
                textAlign: "left"
            }}>
                <h5 style={{
                    color: "var(--primary)",
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                    fontSize: "0.85rem",
                    marginBottom: "15px",
                    fontWeight: "700"
                }}>
                    Step {step + 1} of 5
                </h5>

                <h2 style={{ fontSize: "2rem", marginBottom: "0.5rem", color: "var(--secondary)", fontWeight: "700" }}>
                    {currentQ.scenario}
                </h2>
                <p style={{ fontSize: "1.1rem", color: "var(--grey)", marginBottom: "2rem" }}>
                    Which of these approaches feels most natural to you?
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    {currentQ.options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleOptionSelect(opt.type)}
                            className="option-btn"
                            style={{
                                backgroundColor: "#fff",
                                color: "#444",
                                border: "2px solid #eee",
                                padding: "20px",
                                fontSize: "1.05rem",
                                textAlign: "left",
                                cursor: "pointer",
                                borderRadius: "10px",
                                transition: "all 0.2s ease",
                                position: "relative",
                                display: "flex",
                                alignItems: "center"
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = "var(--primary)";
                                e.currentTarget.style.backgroundColor = "#fff5f5";
                                e.currentTarget.style.transform = "translateY(-2px)";
                                e.currentTarget.style.boxShadow = "0 5px 15px rgba(229, 9, 20, 0.1)";
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = "#eee";
                                e.currentTarget.style.backgroundColor = "#fff";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            <span style={{
                                marginRight: "15px",
                                backgroundColor: "#f0f0f0",
                                width: "30px",
                                height: "30px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                color: "var(--grey)"
                            }}>{String.fromCharCode(65 + idx)}</span>
                            {opt.text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default LearningAssessment;
