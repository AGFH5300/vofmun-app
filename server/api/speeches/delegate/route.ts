import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function DELETE(request: Request) {
  try {
    const { speechID } = await request.json();
    if (!speechID) {
      return new NextResponse(JSON.stringify({ message: "Missing speechID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("Speech")
      .delete()
      .eq("speechID", speechID);

    if (error) {
      return new NextResponse(
        JSON.stringify({ message: `Error deleting speech: ${error.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({ message: "Speech deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new NextResponse(
      JSON.stringify({ message: "Error deleting speech" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  let speechID = body.speechData.speechID



  //marks the start of speech creation logic if it is a new speech

  if (speechID === "-1"){

    console.log("Creating new speech");
    
    const {data} = await supabase
    .from('Speech')
    .select('speechID');

    if (!data || data.length === 0 ) {
      speechID = "0001";
    } else {
    data.sort((a, b) => a.speechID.localeCompare(b.speechID));
    speechID = data.length > 0 ? (parseInt(data[data.length-1].speechID)+1).toString().padStart(4,'0') : '0001';
  }

  const { error : insertedError} = await supabase
  .from('Speech')
  .insert(
    {
      speechID: speechID,
      content: body.speechData.content,
      title: body.speechData.title,
      date: body.speechData.date,
    }
  )

  if (insertedError) {
    return new NextResponse(
      JSON.stringify({ message: "Error inserting speech", error: insertedError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const {error: junctionError } = await supabase
  .from("Delegate-Speech")
  .insert({
    speechID: speechID,
    delegateID: body.delegateID,
  })

  if (junctionError){
    return new NextResponse(
      JSON.stringify({ message: "Error inserting into junction table" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }


  return new NextResponse(
    JSON.stringify({ message: "Speech created successfully", speechID }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );

} else {
  console.log("Updating existing speech with ID:", speechID);
  const { error: updateError } = await supabase
    .from("Speech")
    .update({
      content: body.speechData.content,
      title: body.speechData.title,
      date: body.speechData.date
    })
    .eq("speechID", speechID);
  if (updateError) {
    return new NextResponse(
      JSON.stringify({ message: `Error updating speech: ${updateError.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  return new NextResponse(
    JSON.stringify({ message: "Speech updated successfully", speechID }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const delegateIDParam = searchParams.get("delegateID");
    
    const speechesQuery = supabase
      .from("Delegate-Speech")
      .select("speechID")
      .eq("delegateID", delegateIDParam)
    
    const { data: speechIDs, error: speechesError } = await speechesQuery;
    
    if (speechesError) {
      throw speechesError;
    }
    
    if (!speechIDs || speechIDs.length === 0) {
      return new NextResponse(JSON.stringify({ speeches: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {data : speeches, error: speechesDataError} = await supabase
      .from("Speech")
      .select("*")
      .in("speechID", speechIDs.map(s => s.speechID));

    if (speechesDataError) {
      throw speechesDataError;
    }
  
    const processedSpeeches = speeches?.map(speech => ({
      ...speech,
      tags: [],
    }));

    return new NextResponse(JSON.stringify({ speeches: processedSpeeches }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error in GET /api/speeches:", errorMessage);

    return new NextResponse(
      JSON.stringify({ message: `Error fetching speeches: ${errorMessage}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
