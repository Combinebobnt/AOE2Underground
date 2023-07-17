/* code by Combinebobnt for AoE2 Underground ranking system */
function GETELO(apistring, istg)
{
  if(istg === undefined)
  {
    istg = 0;
  }
  if(istg)
  {
    // remove any rating entries before the teamgame elo adjustment
    const re_adjust = /"[\w\d":,\-]*timestamp":(16[0123456]|166[0123])\d+.*/g;
    apistring = apistring.replace(re_adjust, '');
  }

  // extract all MMRs from the API text
  const re_ratings = /(?<="rating":)\d+/g;
  Logger.log("api string: " + apistring);
  try
  {
    elo = Number(apistring.match(re_ratings)[0]);
  }
  catch(TypeError)
  {
    Logger.log("TypeError");
    elo = 0;
  }
  Logger.log("elo: " + elo);
  return elo;
}

function GETMAXELO(apistring, istg)
{
  if(istg === undefined)
  {
    istg = 0;
  }
  if(istg)
  {
    // remove any rating entries before the teamgame elo adjustment
    const re_adjust = /"[\w\d":,\-]*timestamp":(16[0123456]|166[0123])\d+.*/g;
    apistring = apistring.replace(re_adjust, '');
  }

  // extract all MMRs from the API text
  const re_ratings = /(?<="rating":)\d+/g;
  const array = [...apistring.matchAll(re_ratings)];
  max = 0;

  // find the biggest MMRs (max)
  for (let i = 0; i < array.length; i++)
  {
      mmr = Number(array[i][0]);
      if(mmr > max)
      {
        max = mmr;
      }
  }
  return max;
}

const ratings = ["F", "E", "D", "C", "B", "A", "S", "S+", "S+", "S++", "S+++", "S++++", "S+++++"];

function ELOTOTIER(elo, group_size=200, c_tier_rating=1500)
{
  const c_tier_rating_index = ratings.indexOf("C");
  
  i = Math.floor((elo + (group_size / 2) - c_tier_rating) / group_size) + c_tier_rating_index;

  // prevent out-of-bounds
  i = i <= 0 ? 0 : i;
  i = i >= ratings.length - 1 ? ratings.length - 1 : i;

  return ratings[i];
}

function TIERNUM(tier_letter)
{
  let retval = ratings.indexOf(tier_letter);
  if(retval < 0 || retval > ratings.length)
  {
    retval = "";
  }
  return retval;
}

function ADD_TO_DATA_ENTRY(name, id)
{
  data_entry_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data Entry");
  data_entry_sheet_range = data_entry_sheet.getRange("$A2:B");
  data_entry_sheet_values = data_entry_sheet_range.getValues();
  let add_new = true;
  let last_row = 0
  // iterate over each row in data entry
  for(let r = 0; r < data_entry_sheet_range.getNumRows(); r++)
  {
    if(id == data_entry_sheet_values[r][1])
    {
      add_new = false;
      break;
    }
    if(data_entry_sheet_values[r][1] == "")
    {
      last_row = r;
      break;
    }
  }
  if(add_new)
  {
    data_entry_sheet_first_row = data_entry_sheet.getRange("$A" + (last_row + 3) + ":B" + (last_row + 3));
    data_entry_sheet_first_row.insertCells(SpreadsheetApp.Dimension.ROWS);
    // +2 instead of +3 since this is starting at index 1 instead of 0 (array)
    data_entry_sheet.getRange("$A" + (last_row + 2)).setValue(name);
    data_entry_sheet.getRange("$B" + (last_row + 2)).setValue(id);
  }
}

function RECORD_TEAM_SIGN_UP()
{
  player_info_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Player Info");
  player_info_sheet_range = player_info_sheet.getRange("$A2:L");
  player_info_sheet_values = player_info_sheet_range.getValues();

  signup_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Team Sign Ups");
  signup_sheet_range = signup_sheet.getRange("$A2:L");
  signup_sheet_values = signup_sheet_range.getValues();

  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "")
    {
      continue;
    }

    // TODO read column headers instead of hard coding
    const tier_columns = [5, 8, 11];
    for(let p = 0; p < tier_columns.length; p++)
    {
      Logger.log("RECORD_TEAM_SIGN_UP() signup_sheet_values[" + r + "][tier_columns[" + p + "]] = " + signup_sheet_values[r][tier_columns[p]]);
      if(signup_sheet_values[r][tier_columns[p]] == "")
      {
        player_name = signup_sheet_values[r][tier_columns[p] - 2];
        player_id = signup_sheet_values[r][tier_columns[p] - 1];
        // also add player to data entry list
        ADD_TO_DATA_ENTRY(player_name, player_id);
        for(let x = 0; x < player_info_sheet_range.getNumRows(); x++)
        {
          const player_id_column = 1;
          const player_tier_column = 9;
          if(player_info_sheet_values[x][player_id_column] == player_id)
          {
            Logger.log("RECORD_TEAM_SIGN_UP() R" + (r + 2) + "C" + (tier_columns[p] + 1) + "= " + "player info row: " + x +  " (" + player_info_sheet_values[x] + ")");
            cell_to_change = signup_sheet.getRange("R" + (r + 2) + "C" + (tier_columns[p] + 1));
            cell_to_change.setValue(player_info_sheet_values[x][player_tier_column]);
            Logger.log("RECORD_TEAM_SIGN_UP() signup_sheet_values[" + r + "][tier_columns[" + p + "]] = " + cell_to_change.getValues());
            break;
          }
        }
      }
    }
  }
}

function RECORD_INDIVIDUAL_SIGN_UP()
{
  signup_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Individual Sign Ups");
  signup_sheet_range = signup_sheet.getRange("$A2:C");
  signup_sheet_values = signup_sheet_range.getValues();

  // iterate over each row in sign ups
  for(let r = 0; r < signup_sheet_range.getNumRows(); r++)
  {
    // skip blank rows
    if(signup_sheet_values[r][0] == "")
    {
      continue;
    }
    Logger.log("RECORD_INDIVIDUAL_SIGN_UP() signup_sheet_values[" + r + "][2] = " + signup_sheet_values[r][2]);
    player_name = signup_sheet_values[r][1];
    player_id = signup_sheet_values[r][2];
    // add player to data entry list
    ADD_TO_DATA_ENTRY(player_name, player_id);
  }
}

function FORM_UPDATES()
{
  RECORD_TEAM_SIGN_UP()
  RECORD_INDIVIDUAL_SIGN_UP()
}
